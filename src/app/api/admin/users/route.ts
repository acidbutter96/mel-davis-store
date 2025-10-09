import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
	const auth = await requireAdmin();
	if ("error" in auth) return auth.error;

	const { searchParams } = new URL(req.url);
	const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));
	const page = Math.max(1, Number(searchParams.get("page") || 1));
	const q = (searchParams.get("q") || "").trim().toLowerCase();

	const db = await getDb();
	const filter: Record<string, unknown> = {};
	if (q)
		(filter as { email?: unknown }).email = {
			$regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
			$options: "i",
		};

	const cursor = db
		.collection("users")
		.find(filter, { projection: { passwordHash: 0 } })
		.sort({ createdAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit);
	const items = await cursor.toArray();
	const total = await db.collection("users").countDocuments(filter);

	return Response.json({
		page,
		limit,
		total,
		items: items.map((u) => ({ ...u, _id: String((u as { _id: unknown })._id) })),
	});
}
