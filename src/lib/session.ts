import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env.mjs";
import { generateSid } from "@/lib/session-core";

if (!env.JWT_SECRET) {
	throw new Error("JWT_SECRET must be defined");
}

const key = new TextEncoder().encode(env.JWT_SECRET);
const SessionDuration = 5 * 60 * 60 * 1000; // 5h

export interface UserPayload {
	id: string;
	email: string;
	name?: string;
	role?: "admin" | "customer";
}

export interface SessionData extends JWTPayload {
	user: UserPayload;
	expires: number; // epoch ms
}

export async function encrypt(payload: SessionData): Promise<string> {
	const expSeconds = Math.floor(payload.expires / 1000);
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(expSeconds)
		.sign(key);
}

export async function decrypt(input: string): Promise<SessionData | null | undefined> {
	try {
		const r = await jwtVerify(input, key, { algorithms: ["HS256"] });
		return r.payload as SessionData;
	} catch (e) {
		if (e instanceof Error) console.log(e.message);
	}
}

export async function auth() {
	const token = (await cookies()).get("session")?.value;
	if (!token) return null;
	const data = await decrypt(token);
	if (!data || data.expires < Date.now()) {
		(await cookies()).delete("session");
		return null;
	}
	const { getDb } = await import("@/lib/mongodb");
	const db = await getDb();
	const existing = await db.collection("sessions").findOne({ jwt: token, userId: data.user.id });
	if (!existing) {
		(await cookies()).delete("session");
		return null;
	}
	return data;
}

export async function createPersistentSession(user: {
	id: string;
	email: string;
	name?: string;
	role?: "admin" | "customer";
}) {
	const expires = Date.now() + SessionDuration;
	const payload: SessionData = { user, expires };
	const jwt = await encrypt(payload);
	const sid = generateSid();
	const { getDb } = await import("@/lib/mongodb");
	const db = await getDb();
	await db
		.collection("sessions")
		.insertOne({ sid, userId: user.id, jwt, expires, expiresAt: new Date(expires), createdAt: new Date() });
	(await cookies()).set("session", jwt, {
		expires: new Date(expires),
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	});
	return { sid, jwt, expires };
}

export async function revokeSessionByJwt(jwt: string) {
	const { getDb } = await import("@/lib/mongodb");
	const db = await getDb();
	await db.collection("sessions").deleteOne({ jwt });
}

export async function revokeAllUserSessions(userId: string) {
	const { getDb } = await import("@/lib/mongodb");
	const db = await getDb();
	await db.collection("sessions").deleteMany({ userId });
}

export async function updateSession(_request: NextRequest) {
	const jwt = (await cookies()).get("session")?.value;
	if (!jwt) return NextResponse.next();
	const data = await decrypt(jwt);
	if (!data) return NextResponse.next();
	const { getDb } = await import("@/lib/mongodb");
	const db = await getDb();
	const existing = await db.collection("sessions").findOne({ jwt, userId: data.user.id });
	if (!existing) {
		(await cookies()).delete("session");
		return NextResponse.next();
	}
	if (data.expires - Date.now() < 60 * 60 * 1000) {
		data.expires = Date.now() + SessionDuration;
		const newJwt = await encrypt(data);
		await db
			.collection("sessions")
			.updateOne(
				{ jwt },
				{ $set: { jwt: newJwt, expires: data.expires, expiresAt: new Date(data.expires) } },
			);
		const res = NextResponse.next();
		res.cookies.set({
			name: "session",
			value: newJwt,
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			expires: new Date(data.expires),
		});
		return res;
	}
	return NextResponse.next();
}

export { SessionDuration };
