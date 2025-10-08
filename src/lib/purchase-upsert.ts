import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

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
	id: string; // checkout session id
	createdAt: Date;
	status: string;
	amountTotal: number;
	currency: string;
	items: UserPurchaseItem[];
	statusHistory?: PurchaseStatusChange[];
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
	} = params;
	const db = await getDb();
	const usersCol = db.collection<UserDoc>("users");
	const historyEntry: PurchaseStatusChange = { at: new Date(), event: eventType, status, note };

	const updateExisting = await usersCol.updateOne(
		{ _id: new ObjectId(userId), "purchases.id": sessionId },
		{
			$set: {
				"purchases.$.status": status,
				...(paymentIntentId ? { "purchases.$.paymentIntentId": paymentIntentId } : {}),
				...(chargeId ? { "purchases.$.chargeId": chargeId } : {}),
				...(refundedAmount != null ? { "purchases.$.refundedAmount": refundedAmount } : {}),
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
						paymentIntentId: paymentIntentId || null,
						chargeId: chargeId || null,
						refundedAmount: refundedAmount ?? 0,
					},
				},
			},
		);
	}
}
