import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";

const schema = z.object({ token: z.string().min(16), password: z.string().min(10) });

function isStrongPassword(pw: string) {
	const minLen = pw.length >= 10;
	const upper = /[A-Z]/.test(pw);
	const lower = /[a-z]/.test(pw);
	const digit = /[0-9]/.test(pw);
	const special = /[^A-Za-z0-9]/.test(pw);
	return minLen && upper && lower && digit && special;
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { token, password } = schema.parse(body);
		if (!isStrongPassword(password)) {
			return new Response(JSON.stringify({ error: "Password does not meet strength requirements" }), {
				status: 400,
			});
		}

		const db = await getDb();
		const now = new Date();

		// Find user by token first (handles different stored types) and check expiry explicitly
		const user = await db.collection("users").findOne({ "passwordReset.token": token });
		if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 400 });

		const expiresAtRaw = user.passwordReset?.expiresAt;
		const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
		if (!expiresAt || expiresAt <= now)
			return new Response(JSON.stringify({ error: "Expired token" }), { status: 400 });

		const hashed = await bcrypt.hash(password, 10);
		const upd = await db
			.collection("users")
			.updateOne(
				{ _id: user._id, "passwordReset.token": token },
				{ $set: { passwordHash: hashed }, $unset: { passwordReset: "" } },
			);
		if (!upd || upd.modifiedCount !== 1) {
			// If the update didn't apply, the token is likely already used or invalid
			return new Response(JSON.stringify({ error: "Invalid or already used token" }), { status: 400 });
		}

		return new Response(JSON.stringify({ ok: true }));
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
	}
}

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const token = url.searchParams.get("token");
		if (!token)
			return new Response(JSON.stringify({ valid: false, error: "Missing token" }), { status: 400 });

		const db = await getDb();
		const user = await db.collection("users").findOne({ "passwordReset.token": token });
		if (!user) return new Response(JSON.stringify({ valid: false, error: "Invalid token" }), { status: 200 });

		const expiresAtRaw = user.passwordReset?.expiresAt;
		const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
		const now = new Date();
		if (!expiresAt || expiresAt <= now) {
			return new Response(JSON.stringify({ valid: false, error: "Expired token" }), { status: 200 });
		}

		return new Response(JSON.stringify({ valid: true }), { status: 200 });
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ valid: false, error: "Server error" }), { status: 500 });
	}
}
