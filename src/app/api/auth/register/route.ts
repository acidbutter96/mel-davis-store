import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { z } from "zod";
import { env } from "@/env.mjs";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { createPersistentSession } from "@/lib/session";

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

		const userId = res.insertedId.toString();
		await createPersistentSession({ id: userId, email: emailLower, name: data.name });
		const legacyToken = await new SignJWT({ sub: userId, email: emailLower })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("7d")
			.sign(getJwtSecretKey());
		return new Response(
			JSON.stringify({
				token: legacyToken,
				user: { _id: userId, email: emailLower, name: data.name },
				autoLoggedIn: true,
			}),
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof z.ZodError) {
			return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		}
		console.error("[POST /api/auth/register]", err);
		return new Response(JSON.stringify({ error: "Failed to register" }), { status: 500 });
	}
}
