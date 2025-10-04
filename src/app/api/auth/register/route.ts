import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { z } from "zod";
import { env } from "@/env.mjs";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { encrypt, SessionDuration } from "@/lib/session";

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	name: z.string().min(1),
	phone: z.string().min(6).optional(),
	address: z
		.object({
			line1: z.string().min(1).optional(),
			line2: z.string().optional(),
			city: z.string().min(1).optional(),
			state: z.string().optional(),
			postalCode: z.string().optional(),
			country: z
				.string()
				.min(2)
				.max(64)
				.transform((v) => v.trim().toUpperCase())
				.optional(),
		})
		.optional(),
});

function getJwtSecretKey() {
	return new TextEncoder().encode(env.JWT_SECRET);
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const data = registerSchema.parse(body);
		await ensureIndexes();
		const db = await getDb();

		const emailLower = data.email.toLowerCase();
		const existing = await db.collection("users").findOne({ email: emailLower });
		if (existing) {
			return new Response(JSON.stringify({ error: "Email already registered" }), { status: 409 });
		}

		const passwordHash = await bcrypt.hash(data.password, 10);
		const now = new Date();
		const userDoc = {
			email: emailLower,
			name: data.name,
			phone: data.phone,
			address: data.address,
			passwordHash,
			createdAt: now,
			updatedAt: now,
		};

		const res = await db.collection("users").insertOne(userDoc);

		// Legacy token (auth_token) generation - kept temporarily until future refactor
		const legacyToken = await new SignJWT({ sub: res.insertedId.toString(), email: emailLower })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("7d")
			.sign(getJwtSecretKey());

		// Create 5h session for immediate auto-login
		const sessionPayload = {
			user: { id: res.insertedId.toString(), email: emailLower, name: data.name },
			expires: Date.now() + SessionDuration,
		};
		const sessionToken = await encrypt(sessionPayload);

		const cookies: string[] = [];
		cookies.push(`auth_token=${legacyToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`);
		cookies.push(
			`session=${sessionToken}; HttpOnly; Path=/; Max-Age=${Math.floor(SessionDuration / 1000)}; SameSite=Lax; Secure=${process.env.NODE_ENV === "production"}; Expires=${new Date(
				sessionPayload.expires,
			).toUTCString()}`,
		);

		const response = new Response(
			JSON.stringify({
				user: { _id: res.insertedId.toString(), email: emailLower, name: data.name },
				autoLoggedIn: true,
			}),
			{ status: 201 },
		);
		for (const ck of cookies) response.headers.append("Set-Cookie", ck);
		return response;
	} catch (err) {
		if (err instanceof z.ZodError) {
			return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		}
		console.error("[POST /api/auth/register]", err);
		return new Response(JSON.stringify({ error: "Failed to register" }), { status: 500 });
	}
}
