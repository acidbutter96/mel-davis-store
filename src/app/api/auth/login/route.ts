import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/env.mjs";
import { getDb } from "@/lib/mongodb";

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

function getJwtSecretKey() {
	return new TextEncoder().encode(env.JWT_SECRET);
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { email, password } = loginSchema.parse(body);
		const db = await getDb();
		const user = await db
			.collection("users")
			.findOne<{ _id: unknown; email: string; passwordHash?: string; name?: string }>({
				email: email.toLowerCase(),
			});
		if (!user || !user.passwordHash) {
			return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
		}
		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) {
			return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
		}

		const token = await new SignJWT({ sub: String(user._id), email: user.email })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("7d")
			.sign(getJwtSecretKey());

		return new Response(
			JSON.stringify({ user: { _id: String(user._id), email: user.email, name: user.name } }),
			{
				status: 200,
				headers: {
					"Set-Cookie": `auth_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
				},
			},
		);
	} catch (err) {
		if (err instanceof z.ZodError) {
			return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		}
		console.error("[POST /api/auth/login]", err);
		return new Response(JSON.stringify({ error: "Login error" }), { status: 500 });
	}
}
