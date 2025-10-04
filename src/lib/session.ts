import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env.mjs";

if (!env.JWT_SECRET) {
	throw new Error("JWT_SECRET must be defined");
}

const key = new TextEncoder().encode(env.JWT_SECRET);
const SessionDuration = 5 * 60 * 60 * 1000; // 5h

export interface UserPayload {
	id: string;
	email: string;
	name?: string;
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
	const session = (await cookies()).get("session")?.value;
	if (!session) return null;
	const data = await decrypt(session);
	if (!data || data.expires < Date.now()) {
		(await cookies()).delete("session");
		return null;
	}
	return data;
}

export async function updateSession(_request: NextRequest) {
	const session = (await cookies()).get("session")?.value;
	if (!session) return;
	const data = await decrypt(session);
	if (!data) return;
	if (data.expires - Date.now() < 60 * 60 * 1000) {
		// <1h
		data.expires = Date.now() + SessionDuration;
		const res = NextResponse.next();
		res.cookies.set({
			name: "session",
			value: await encrypt(data),
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
