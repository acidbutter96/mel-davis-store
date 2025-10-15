import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
	const auth = await requireAdmin();
	if (auth.error) return auth.error;
	const url = new URL(req.url);
	const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
	const skip = Math.max(Number(url.searchParams.get("skip") || "0"), 0);
	const db = await getDb();
	const col = db.collection("webhooks");
	const items = await col.find().sort({ receivedAt: -1 }).skip(skip).limit(limit).toArray();
	return new Response(JSON.stringify({ items }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}
