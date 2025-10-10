"use server";

import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { env } from "@/env.mjs";
import { requireAuth } from "@/lib/api-auth";
import { clearCartId, getCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";
import type { UserCart } from "@/lib/mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Clears the cart stored on the user document after the checkout is finalized.
 * Also removes the legacy in-memory/cookie cart, if it exists, to keep things consistent.
 */
export async function finalizeCheckoutCleanup(): Promise<{ ok: true } | { error: string }> {
	const auth = await requireAuth();
	if ("error" in auth) return { error: "Unauthorized" };

	const userId = auth.session.sub as string;

	try {
		const db = await getDb();

		await db
			.collection("users")
			.updateOne({ _id: new ObjectId(userId) }, { $unset: { cart: "" }, $set: { updatedAt: new Date() } });

		const cartId = await getCartId();

		if (cartId) {
			try {
				await commerce.cart.clear({ cartId });
			} catch (e) {}
			await clearCartId();
		}

		return { ok: true };
	} catch (err) {
		console.error("[finalizeCheckoutCleanup]", err);
		return { error: "Failed to cleanup cart" };
	}
}

/**
 * Saves a purchase on the user document using the session_id returned on success_url.
 * This doesn't replace the webhook (source of truth), but it allows immediate recording.
 */
export async function recordSuccessfulCheckout(sessionId: string): Promise<{ ok: true } | { error: string }> {
	if (!sessionId || !sessionId.startsWith("cs_")) return { error: "Invalid session id" };
	if (!env.STRIPE_SECRET_KEY) return { error: "Stripe not configured" };

	const auth = await requireAuth();
	let userId: string | null = null;

	if (!("error" in auth)) userId = auth.session.sub as string;

	try {
		const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ["line_items.data.price.product"],
		});

		if (session.metadata?.userId) {
			const metaUserId = String(session.metadata.userId);
			if (userId && metaUserId !== userId) return { error: "Session does not belong to user" };
			if (!userId) userId = metaUserId;
		}

		if (!userId) return { error: "Unauthorized" };

		const items = (session.line_items?.data || []).map((li) => {
			const prod = typeof li.price?.product === "object" ? (li.price?.product as Stripe.Product) : undefined;
			return {
				priceId: li.price?.id || null,
				productId: prod?.id || null,
				name: prod?.name || null,
				quantity: li.quantity || 0,
				unitAmount: li.price?.unit_amount ?? null,
			};
		});
		const userObjectId = new ObjectId(userId);
		const purchase = {
			id: session.id,
			createdAt: new Date(),
			status: session.payment_status || session.status || "unknown",
			amountTotal: session.amount_total || 0,
			currency: (session.currency || env.STRIPE_CURRENCY || "USD").toUpperCase(),
			items,
			invoiceId: (session.invoice as string) || null,
			paymentIntentId: (session.payment_intent as string) || null,
		};
		const db = await getDb();
		const usersCol = db.collection("users");
		const userDoc = await usersCol.findOne<{ cart?: UserCart }>(
			{ _id: userObjectId },
			{ projection: { cart: 1 } },
		);
		const cartSnapshot: UserCart | null = userDoc?.cart
			? { items: userDoc.cart.items.map((item) => ({ ...item })) }
			: null;
		const userUpdateCol = usersCol as unknown as {
			updateOne: (filter: unknown, update: unknown) => Promise<unknown>;
		};

		// Idempotência: não insere se já existir purchase com mesmo id
		const existing = await usersCol.findOne(
			{ _id: userObjectId, "purchases.id": session.id },
			{ projection: { _id: 1 } },
		);
		if (!existing) {
			await userUpdateCol.updateOne(
				{ _id: userObjectId },
				{
					$push: { purchases: { ...purchase, cart: cartSnapshot } },
					$set: { updatedAt: new Date() },
					$unset: { cart: "" },
				},
			);
		}
		return { ok: true };
	} catch (e) {
		console.error("[recordSuccessfulCheckout]", e);
		return { error: "Failed to record purchase" };
	}
}

export async function getPurchaseDetails(purchaseId: string): Promise<
	| { error: string }
	| {
			id: string;
			status: string;
			createdAt: Date | string;
			amountTotal: number;
			currency: string;
			items: Array<{
				name: string | null;
				quantity: number;
				unitAmount: number | null;
				priceId: string | null;
				productId: string | null;
				image: string | null;
			}>;
			fulfillment?: { status?: "received" | "producing" | "shipped"; trackingNumber?: string | null };
	  }
> {
	if (!purchaseId) return { error: "Missing purchase id" };
	const auth = await requireAuth();
	if ("error" in auth) return { error: "Unauthorized" };
	try {
		const db = await getDb();
		const userId = new ObjectId(auth.session.sub as string);
		interface PurchaseItemDoc {
			name?: string | null;
			quantity?: number;
			unitAmount?: number | null;
			priceId?: string | null;
			productId?: string | null;
		}
		interface PurchaseDoc {
			id: string;
			status: string;
			createdAt: Date | string;
			amountTotal: number;
			currency: string;
			items?: PurchaseItemDoc[];
			fulfillment?: { status?: "received" | "producing" | "shipped"; trackingNumber?: string | null };
		}
		const userDoc = await db
			.collection("users")
			.findOne<{ purchases?: PurchaseDoc[] }>(
				{ _id: userId, "purchases.id": purchaseId },
				{ projection: { purchases: 1 } },
			);
		const purchase = userDoc?.purchases?.find((p) => p.id === purchaseId);
		if (!purchase) return { error: "Not found" };
		let enrichedItems: Array<{
			name: string | null;
			quantity: number;
			unitAmount: number | null;
			priceId: string | null;
			productId: string | null;
			image: string | null;
		}> = [];
		if (env.STRIPE_SECRET_KEY) {
			try {
				const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });
				for (const it of purchase.items || []) {
					let name: string | null = it.name || null;
					let image: string | null = null;
					if (it.priceId) {
						try {
							const price = await stripe.prices.retrieve(it.priceId);
							const productId = typeof price.product === "string" ? price.product : price.product?.id;
							if (productId) {
								try {
									const product = await stripe.products.retrieve(productId);
									name = product.name || name;
									image = product.images?.[0] || null;
								} catch (e) {}
							}
						} catch (e) {}
					}
					enrichedItems.push({
						name,
						quantity: it.quantity || 0,
						unitAmount: it.unitAmount ?? null,
						priceId: it.priceId || null,
						productId: it.productId || null,
						image,
					});
				}
			} catch (e) {}
		}
		if (enrichedItems.length === 0) {
			enrichedItems = (purchase.items || []).map((it: PurchaseItemDoc) => ({
				name: it.name || null,
				quantity: it.quantity || 0,
				unitAmount: it.unitAmount ?? null,
				priceId: it.priceId || null,
				productId: it.productId || null,
				image: null,
			}));
		}
		return {
			id: purchase.id,
			status: purchase.status,
			createdAt: purchase.createdAt,
			amountTotal: purchase.amountTotal,
			currency: purchase.currency,
			items: enrichedItems,
			fulfillment: purchase.fulfillment,
		};
	} catch (e) {
		console.error("[getPurchaseDetails]", e);
		return { error: "Failed" };
	}
}
