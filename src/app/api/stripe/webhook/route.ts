import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/mongodb";

// NOTE: In the App Router we must read the raw body manually before any parsing.
// Do NOT export a config with bodyParser: false here (that pattern is for pages router).

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
// Use the type's default literal to satisfy Stripe TS definitions (avoid hardcoding outdated date string).
// Initialize with default API version from the library types (avoids hard-coded outdated versions).
const stripe = new Stripe(stripeSecretKey);

async function buffer(readable: ReadableStream<Uint8Array>) {
	const reader = readable.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
	let event: Stripe.Event;
	let bodyBuffer: Buffer;
	try {
		bodyBuffer = await buffer(req.body!);
	} catch (e) {
		return new Response("Failed to read body", { status: 400 });
	}

	const sig = req.headers.get("stripe-signature");
	if (webhookSecret) {
		if (!sig) return new Response("Missing signature", { status: 400 });
		try {
			event = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Unknown error";
			console.error("Stripe signature verification failed", msg);
			return new Response(`Webhook Error: ${msg}`, { status: 400 });
		}
	} else {
		// Unsafe (dev only): directly parse JSON
		try {
			event = JSON.parse(bodyBuffer.toString()) as Stripe.Event;
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Invalid JSON";
			return new Response(`Invalid JSON: ${msg}`, { status: 400 });
		}
	}

	// ---- Generic handling (all events) ----
	try {
		const extracted = extractContext(event);
		if (!extracted.userId || !extracted.rootId) {
			return new Response("ignored", { status: 200 });
		}
		const { userId, rootId, kind, related } = extracted;

		const db = await getDb();

		const rawObj = event.data.object as unknown;
		let derivedStatus = deriveStatus(rawObj, event.type);

		interface UserPurchaseEventDoc {
			eventId: string; // Stripe event id
			type: string; // event.type
			status: string; // status captured at this point
			createdAt: Date; // when we processed (not Stripe timestamp)
			stripeCreated?: number; // Stripe event created (epoch seconds)
		}

		interface UserPurchaseItem {
			name: string | null;
			quantity: number;
			unitAmount: number | null;
			priceId: string | null;
		}

		interface PurchaseDoc {
			id: string;
			createdAt: Date;
			status: string;
			amountTotal: number;
			currency: string;
			items: UserPurchaseItem[];
			kind: string; // e.g. checkout.session | payment_intent | subscription
			events?: UserPurchaseEventDoc[];
			relatedIds?: {
				sessionId?: string;
				paymentIntentId?: string;
				chargeIds?: string[];
				invoiceId?: string;
				subscriptionId?: string;
				refundIds?: string[];
			};
		}

		interface UserDoc {
			_id: ObjectId;
			purchases?: PurchaseDoc[];
		}

		const usersCol = db.collection<UserDoc>("users");

		// Only fetch line items if this is a checkout.session.* event AND the purchase does not yet exist.
		let items: UserPurchaseItem[] = [];
		let amountTotal = 0;
		let currency = "usd";

		if (kind === "checkout.session") {
			const session = event.data.object as Stripe.Checkout.Session;
			currency = (session.currency || "usd").toLowerCase();
			if (typeof session.amount_total === "number") amountTotal = session.amount_total;
			const existing = await usersCol.findOne(
				{
					_id: new ObjectId(userId),
					$or: [{ "purchases.id": rootId }, { "purchases.relatedIds.sessionId": rootId }],
				},
				{ projection: { _id: 1 } },
			);
			if (!existing) {
				const lineItems = await stripe.checkout.sessions.listLineItems(rootId, { limit: 100 });
				items = lineItems.data.map((li) => ({
					name: li.description,
					quantity: li.quantity || 0,
					unitAmount: li.price?.unit_amount ?? null,
					priceId: li.price?.id ?? null,
				}));
				if (!amountTotal) {
					amountTotal = items.reduce(
						(sum, i) => sum + (typeof i.unitAmount === "number" ? i.unitAmount : 0) * i.quantity,
						0,
					);
				}
			}
		} else if (kind === "payment_intent") {
			const pi = event.data.object as Stripe.PaymentIntent;
			currency = (pi.currency || "usd").toLowerCase();
			amountTotal = typeof pi.amount === "number" ? pi.amount : 0;
		} else if (kind === "invoice") {
			const inv = event.data.object as Stripe.Invoice;
			currency = (inv.currency || "usd").toLowerCase();
			amountTotal = typeof inv.amount_paid === "number" ? inv.amount_paid : inv.amount_due || 0;
		} else if (kind === "subscription") {
			const sub = event.data.object as Stripe.Subscription;
			currency = (sub.currency || "usd").toLowerCase();
			amountTotal = 0; // subscription events usually not carry total paid directly here
		} else if (kind === "charge") {
			const charge = event.data.object as Stripe.Charge;
			currency = (charge.currency || "usd").toLowerCase();
			amountTotal = typeof charge.amount === "number" ? charge.amount : 0;
		} else if (kind === "refund") {
			const refund = event.data.object as Stripe.Refund;
			currency = (refund.currency || "usd").toLowerCase();
			amountTotal = typeof refund.amount === "number" ? refund.amount : 0;
		}

		const eventDoc: UserPurchaseEventDoc = {
			eventId: event.id,
			type: event.type,
			status: derivedStatus,
			createdAt: new Date(),
			stripeCreated: event.created,
		};

		// Upsert pattern: try update existing purchase's status + push event (no duplicates by eventId)
		// Build relatedIds update fragment
		const relatedUpdate: Record<string, unknown> = {};
		if (related.sessionId) relatedUpdate["purchases.$.relatedIds.sessionId"] = related.sessionId;
		if (related.paymentIntentId)
			relatedUpdate["purchases.$.relatedIds.paymentIntentId"] = related.paymentIntentId;
		if (related.invoiceId) relatedUpdate["purchases.$.relatedIds.invoiceId"] = related.invoiceId;
		if (related.subscriptionId)
			relatedUpdate["purchases.$.relatedIds.subscriptionId"] = related.subscriptionId;
		if (related.chargeId)
			relatedUpdate["purchases.$.relatedIds.chargeIds"] = {
				$addToSet: related.chargeId,
			};
		if (related.refundId)
			relatedUpdate["purchases.$.relatedIds.refundIds"] = {
				$addToSet: related.refundId,
			};

		// Find purchase by root id OR any related id already stored.
		const updateResult = await usersCol.updateOne(
			{
				_id: new ObjectId(userId),
				$or: [
					{ "purchases.id": rootId },
					{ "purchases.relatedIds.sessionId": rootId },
					{ "purchases.relatedIds.paymentIntentId": rootId },
					{ "purchases.relatedIds.invoiceId": rootId },
					{ "purchases.relatedIds.subscriptionId": rootId },
					{ "purchases.relatedIds.chargeIds": rootId },
					{ "purchases.relatedIds.refundIds": rootId },
				],
				"purchases.events.eventId": { $ne: event.id },
			},
			{
				$set: { "purchases.$.status": derivedStatus },
				$push: { "purchases.$.events": eventDoc },
			},
		);

		if (updateResult.matchedCount === 0) {
			const purchase: PurchaseDoc = {
				id: rootId,
				createdAt: new Date(),
				status: derivedStatus,
				amountTotal,
				currency,
				items,
				kind,
				events: [eventDoc],
				relatedIds: buildRelatedIds(related),
			};
			await usersCol.updateOne(
				{ _id: new ObjectId(userId), "purchases.id": { $ne: rootId } },
				{ $push: { purchases: purchase } },
			);
		}
	} catch (e) {
		console.error("Webhook handling error", e);
		return new Response("Webhook handler failed", { status: 500 });
	}

	return new Response("ok", { status: 200 });
}

export const runtime = "nodejs";

function deriveStatus(rawObj: unknown, eventType: string): string {
	if (
		rawObj &&
		typeof rawObj === "object" &&
		("status" in rawObj || "payment_status" in rawObj) &&
		(typeof (rawObj as Record<string, unknown>).status === "string" ||
			typeof (rawObj as Record<string, unknown>).payment_status === "string")
	) {
		const r = rawObj as { status?: string; payment_status?: string };
		return r.status || r.payment_status || mapEventTypeToStatus(eventType);
	}
	return mapEventTypeToStatus(eventType);
}

function mapEventTypeToStatus(eventType: string): string {
	const map: Record<string, string> = {
		// Checkout Session
		"checkout.session.completed": "paid",
		"checkout.session.async_payment_succeeded": "paid",
		"checkout.session.async_payment_failed": "failed",
		"checkout.session.expired": "expired",
		// Payment Intent
		"payment_intent.succeeded": "succeeded",
		"payment_intent.payment_failed": "failed",
		"payment_intent.canceled": "canceled",
		"payment_intent.processing": "processing",
		// Invoice
		"invoice.paid": "paid",
		"invoice.payment_failed": "failed",
		"invoice.finalized": "finalized",
		"invoice.voided": "voided",
		"invoice.marked_uncollectible": "uncollectible",
		// Charge
		"charge.succeeded": "succeeded",
		"charge.failed": "failed",
		"charge.refunded": "refunded",
		// Refund
		"refund.succeeded": "refunded",
		"refund.updated": "refund_updated",
		// Subscription
		"customer.subscription.created": "created",
		"customer.subscription.updated": "updated",
		"customer.subscription.deleted": "canceled",
		"customer.subscription.pending_update_applied": "updated",
		"customer.subscription.pending_update_expired": "expired",
	};
	return map[eventType] || eventType;
}

interface ExtractedContext {
	userId: string | null;
	rootId: string | null;
	kind: string; // checkout.session | payment_intent | invoice | subscription | charge | refund | unknown
	related: {
		sessionId?: string;
		paymentIntentId?: string;
		invoiceId?: string;
		subscriptionId?: string;
		chargeId?: string;
		refundId?: string;
	};
}

function extractContext(event: Stripe.Event): ExtractedContext {
	const objUnknown = event.data.object as unknown;
	const raw: Record<string, unknown> =
		objUnknown && typeof objUnknown === "object" ? (objUnknown as Record<string, unknown>) : {};
	let userId: string | null = null;
	const metadataVal = raw.metadata;
	if (metadataVal && typeof metadataVal === "object") {
		const userVal = (metadataVal as Record<string, unknown>).userId;
		if (typeof userVal === "string") userId = userVal;
	}

	const related: ExtractedContext["related"] = {};
	let rootId: string | null = null;
	let kind = "unknown";

	const getString = (k: string): string | null => {
		const v = raw[k];
		return typeof v === "string" ? v : null;
	};

	if (event.type.startsWith("checkout.session")) {
		kind = "checkout.session";
		rootId = getString("id");
		if (rootId) related.sessionId = rootId;
		const pi = getString("payment_intent");
		if (pi) related.paymentIntentId = pi;
		const sub = getString("subscription");
		if (sub) related.subscriptionId = sub;
	} else if (event.type.startsWith("payment_intent")) {
		kind = "payment_intent";
		rootId = getString("id");
		if (rootId) related.paymentIntentId = rootId;
		const chargesVal = raw.charges;
		if (chargesVal && typeof chargesVal === "object") {
			const dataArr = (chargesVal as Record<string, unknown>).data as unknown;
			if (Array.isArray(dataArr) && dataArr.length > 0) {
				const first = dataArr[0];
				if (first && typeof first === "object" && typeof (first as { id?: unknown }).id === "string") {
					related.chargeId = (first as { id: string }).id;
				}
			}
		}
	} else if (event.type.startsWith("invoice")) {
		kind = "invoice";
		rootId = getString("id");
		if (rootId) related.invoiceId = rootId;
		const sub = getString("subscription");
		if (sub) related.subscriptionId = sub;
		const pi = getString("payment_intent");
		if (pi) related.paymentIntentId = pi;
	} else if (event.type.startsWith("customer.subscription")) {
		kind = "subscription";
		rootId = getString("id");
		if (rootId) related.subscriptionId = rootId;
	} else if (event.type.startsWith("charge.")) {
		kind = "charge";
		const paymentIntent = getString("payment_intent");
		rootId = paymentIntent || getString("id");
		const chargeId = getString("id");
		if (chargeId) related.chargeId = chargeId;
		if (paymentIntent) related.paymentIntentId = paymentIntent;
	} else if (event.type.startsWith("refund.")) {
		kind = "refund";
		const paymentIntent = getString("payment_intent");
		rootId = paymentIntent || getString("id");
		const refundId = getString("id");
		if (refundId) related.refundId = refundId;
		if (paymentIntent) related.paymentIntentId = paymentIntent;
		const chargeId = getString("charge");
		if (chargeId) related.chargeId = chargeId;
	}

	return { userId, rootId, kind, related };
}

function buildRelatedIds(related: ExtractedContext["related"]): PurchaseDoc["relatedIds"] {
	const out: PurchaseDoc["relatedIds"] = {};
	if (related.sessionId) out.sessionId = related.sessionId;
	if (related.paymentIntentId) out.paymentIntentId = related.paymentIntentId;
	if (related.invoiceId) out.invoiceId = related.invoiceId;
	if (related.subscriptionId) out.subscriptionId = related.subscriptionId;
	if (related.chargeId) out.chargeIds = [related.chargeId];
	if (related.refundId) out.refundIds = [related.refundId];
	return out;
}

interface UserPurchaseEventDoc {
	eventId: string;
	type: string;
	status: string;
	createdAt: Date;
	stripeCreated?: number;
}
interface UserPurchaseItem {
	name: string | null;
	quantity: number;
	unitAmount: number | null;
	priceId: string | null;
}
interface PurchaseDoc {
	id: string;
	createdAt: Date;
	status: string;
	amountTotal: number;
	currency: string;
	items: UserPurchaseItem[];
	kind: string;
	events?: UserPurchaseEventDoc[];
	relatedIds?: {
		sessionId?: string;
		paymentIntentId?: string;
		chargeIds?: string[];
		invoiceId?: string;
		subscriptionId?: string;
		refundIds?: string[];
	};
}
