import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/env.mjs";
import { getDb } from "@/lib/mongodb";
import { decrypt } from "@/lib/session";

async function getUserIdFromAuthHeader(): Promise<string | null> {
	const h = await import("next/headers").then((m) => m.headers());
	const auth = (await h).get("authorization") || (await h).get("Authorization");
	if (!auth?.startsWith("Bearer ")) return null;
	const token = auth.slice(7).trim();
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
		if (payload && typeof payload.sub === "string") return payload.sub;
	} catch {}
	return null;
}

export async function GET() {
	let userId: string | null = null;
	userId = await getUserIdFromAuthHeader();
	if (!userId) {
		const sessionToken = (await cookies()).get("session")?.value;
		if (sessionToken) {
			const data = await decrypt(sessionToken);
			if (data && data.expires > Date.now()) userId = data.user.id;
		}
	}
	if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	const db = await getDb();
	const user = await db
		.collection("users")
		.findOne<{ _id: unknown; email: string; name?: string }>(
			{ _id: { $eq: (await import("mongodb")).ObjectId.createFromHexString(userId) } },
			{ projection: { passwordHash: 0 } },
		)
		.catch(async () => {
			const { ObjectId } = await import("mongodb");
			try {
				return await db
					.collection("users")
					.findOne({ _id: new ObjectId(userId!) }, { projection: { passwordHash: 0 } });
			} catch {
				return null;
			}
		});
	if (!user) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
	const idValue = (user as { _id: unknown })._id;
	return Response.json({ ...user, _id: String(idValue) });
}
