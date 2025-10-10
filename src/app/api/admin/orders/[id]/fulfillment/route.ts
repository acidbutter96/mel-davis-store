import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";

type FulfillmentStatus = "received" | "producing" | "shipped";
const ORDER: FulfillmentStatus[] = ["received", "producing", "shipped"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAdmin();
	if ("error" in auth) return auth.error;
	const { id } = await params;
	if (!id) return new Response("Missing id", { status: 400 });

	const body = (await req.json().catch(() => ({}))) as {
		status?: FulfillmentStatus;
		trackingNumber?: string | null;
	};
	const nextStatus = body.status ?? undefined;
	const trackingNumber = body.trackingNumber ?? undefined;
	if (!nextStatus && trackingNumber === undefined) return new Response("No changes", { status: 400 });
	if (nextStatus && !ORDER.includes(nextStatus)) return new Response("Invalid status", { status: 400 });

	const db = await getDb();
	const users = db.collection("users");
	const foundList = await users
		.aggregate([
			{ $match: { purchases: { $exists: true, $ne: [] } } },
			{ $project: { purchases: 1 } },
			{ $unwind: "$purchases" },
			{ $match: { "purchases.id": id } },
			{ $limit: 1 },
		])
		.toArray();
	const found = foundList[0] as
		| { purchases: { id: string; fulfillment?: { status?: FulfillmentStatus } } }
		| undefined;
	if (!found) return new Response("Not found", { status: 404 });

	const current = (found.purchases.fulfillment?.status as FulfillmentStatus | undefined) || undefined;
	if (nextStatus && current) {
		const currIdx = ORDER.indexOf(current);
		const nextIdx = ORDER.indexOf(nextStatus);
		if (nextIdx < currIdx) return new Response("Cannot move backward", { status: 409 });
	}

	const set: Record<string, unknown> = {};
	if (nextStatus) set["purchases.$.fulfillment.status"] = nextStatus;
	if (trackingNumber !== undefined) set["purchases.$.fulfillment.trackingNumber"] = trackingNumber ?? null;
	await users.updateOne({ "purchases.id": id }, { $set: set });

	return Response.json({ ok: true });
}
