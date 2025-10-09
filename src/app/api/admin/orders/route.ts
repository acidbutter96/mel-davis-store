import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
	const auth = await requireAdmin();
	if ("error" in auth) return auth.error;

	const { searchParams } = new URL(req.url);
	const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));
	const page = Math.max(1, Number(searchParams.get("page") || 1));
	const status = (searchParams.get("status") || "").trim().toLowerCase();
	const sort = (searchParams.get("sort") || "date-desc").toLowerCase();
	const period = (searchParams.get("period") || "").toLowerCase();

	const now = new Date();
	let since: Date | null = null;
	if (period === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	else if (period === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	else if (period === "90d") since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
	else if (period === "365d") since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

	const db = await getDb();
	const pipeline: Record<string, unknown>[] = [
		{ $match: { purchases: { $exists: true, $ne: [] } } },
		{ $project: { email: 1, purchases: 1 } },
		{ $unwind: "$purchases" },
	];

	const match: Record<string, unknown> = {};
	if (status) match["purchases.status"] = status;
	if (since) match["purchases.createdAt"] = { $gte: since };
	if (Object.keys(match).length) pipeline.push({ $match: match });

	let sortStage: Record<string, 1 | -1> = { "purchases.createdAt": -1 };
	if (sort === "date-asc") sortStage = { "purchases.createdAt": 1 };
	if (sort === "amount-desc") sortStage = { "purchases.amountTotal": -1 };
	if (sort === "amount-asc") sortStage = { "purchases.amountTotal": 1 };
	pipeline.push({ $sort: sortStage });

	const skip = (page - 1) * limit;
	pipeline.push({ $skip: skip }, { $limit: limit });

	const cursor = db.collection("users").aggregate(pipeline);
	const items = await cursor.toArray();

	// Count total matching
	const countPipeline = pipeline
		.filter((s) => !("$skip" in s) && !("$limit" in s))
		.concat([{ $count: "total" }]);
	const countRes = await db.collection("users").aggregate(countPipeline).toArray();
	const total = countRes[0]?.total || 0;

	return Response.json({
		page,
		limit,
		total,
		items: items.map((d) => ({
			id: d.purchases.id,
			userEmail: d.email,
			amountTotal: d.purchases.amountTotal,
			currency: d.purchases.currency,
			status: d.purchases.status,
			createdAt: d.purchases.createdAt,
		})),
	});
}
