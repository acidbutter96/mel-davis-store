"use server";

import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { env } from "@/env.mjs";
import { requireAuth } from "@/lib/api-auth";
import { clearCartId, getCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";
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
	if ("error" in auth) return { error: "Unauthorized" };
	const userId = auth.session.sub as string;
	try {
		const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ["line_items.data.price.product"],
		});
		if (session.metadata?.userId && session.metadata.userId !== userId) {
			return { error: "Session does not belong to user" };
		}
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
		const usersCol = db.collection("users") as unknown as {
			updateOne: (filter: unknown, update: unknown) => Promise<unknown>;
		};
		await usersCol.updateOne(
			{ _id: new ObjectId(userId) },
			{ $push: { purchases: purchase }, $set: { updatedAt: new Date() } },
		);
		return { ok: true };
	} catch (e) {
		console.error("[recordSuccessfulCheckout]", e);
		return { error: "Failed to record purchase" };
	}
}
