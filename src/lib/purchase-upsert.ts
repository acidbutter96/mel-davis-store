import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { notifyOrderStatusChange } from "./notify-order-status";

export interface UserPurchaseItem {
	name: string | null;
	quantity: number;
	unitAmount: number | null;
	priceId: string | null;
}
export interface PurchaseStatusChange {
	at: Date;
	event: string;
	status: string;
	note?: string;
}
export interface PurchaseDoc {
	id: string;
	createdAt: Date;
	status: string;
	amountTotal: number;
	currency: string;
	items: UserPurchaseItem[];
	statusHistory?: PurchaseStatusChange[];
	fulfillment?: { status?: "received" | "producing" | "shipped"; trackingNumber?: string | null };
	paymentIntentId?: string | null;
	chargeId?: string | null;
	refundedAmount?: number;
}
interface UserDoc {
	_id: ObjectId;
	purchases?: PurchaseDoc[];
}

export interface UpsertPurchaseParams {
	userId: string;
	sessionId: string;
	status: string;
	eventType: string;
	amountTotal?: number | null;
	currency?: string | null;
	items?: UserPurchaseItem[];
	paymentIntentId?: string | null;
	chargeId?: string | null;
	refundedAmount?: number | null;
	note?: string;
	fulfillment?: { status?: "received" | "producing" | "shipped"; trackingNumber?: string | null };
}

// Upsert purchase inside embedded purchases array. Appends status history each call.
export async function upsertPurchase(params: UpsertPurchaseParams) {
	const {
		userId,
		sessionId,
		status,
		eventType,
		amountTotal,
		currency,
		items,
		paymentIntentId,
		chargeId,
		refundedAmount,
		note,
		fulfillment,
	} = params;
	const db = await getDb();
	const usersCol = db.collection<UserDoc>("users");
	const historyEntry: PurchaseStatusChange = { at: new Date(), event: eventType, status, note };

	// Fetch existing purchase status (if any) to compare and avoid duplicate notifications
	const existingUser = await usersCol.findOne(
		{ _id: new ObjectId(userId), "purchases.id": sessionId },
		{ projection: { "purchases.$": 1 } },
	);
	const existingPurchase = existingUser?.purchases?.[0];
	const prevStatus = existingPurchase?.status as string | undefined;

	const updateExisting = await usersCol.updateOne(
		{ _id: new ObjectId(userId), "purchases.id": sessionId },
		{
			$set: {
				"purchases.$.status": status,
				...(paymentIntentId ? { "purchases.$.paymentIntentId": paymentIntentId } : {}),
				...(chargeId ? { "purchases.$.chargeId": chargeId } : {}),
				...(refundedAmount != null ? { "purchases.$.refundedAmount": refundedAmount } : {}),
				...(fulfillment
					? {
							"purchases.$.fulfillment": {
								...(fulfillment.status ? { status: fulfillment.status } : {}),
								...(fulfillment.trackingNumber !== undefined
									? { trackingNumber: fulfillment.trackingNumber ?? null }
									: {}),
							},
						}
					: {}),
			},
			$push: { "purchases.$.statusHistory": historyEntry },
		},
	);
	if (updateExisting.matchedCount === 0) {
		await usersCol.updateOne(
			{ _id: new ObjectId(userId), "purchases.id": { $ne: sessionId } },
			{
				$push: {
					purchases: {
						id: sessionId,
						createdAt: new Date(),
						status,
						amountTotal: amountTotal ?? 0,
						currency: (currency || "usd").toLowerCase(),
						items: items || [],
						statusHistory: [historyEntry],
						...(fulfillment ? { fulfillment } : {}),
						paymentIntentId: paymentIntentId || null,
						chargeId: chargeId || null,
						refundedAmount: refundedAmount ?? 0,
					},
				},
			},
		);
		// New purchase created — notify customer about the initial status
		try {
			await notifyOrderStatusChange(userId, sessionId, status);
		} catch (err) {
			console.error("notifyOrderStatusChange failed (create)", err);
		}
	} else {
		// Existing purchase updated — only notify if status actually changed
		if (prevStatus !== status) {
			try {
				await notifyOrderStatusChange(userId, sessionId, status);
			} catch (err) {
				console.error("notifyOrderStatusChange failed (update)", err);
			}
		}
	}
}
