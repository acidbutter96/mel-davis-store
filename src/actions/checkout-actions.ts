"use server";

import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { env, publicUrl } from "@/env.mjs";
import { requireAuth } from "@/lib/api-auth";
import { commerce } from "@/lib/commerce-stripe";
import type { Cart } from "@/lib/commerce-types";
import { getDb } from "@/lib/mongodb";

export async function createCheckoutSession(): Promise<
	{ url: string } | { error: string } | { requireAuth: true }
> {
	if (!env.STRIPE_SECRET_KEY) {
		return { error: "Missing Stripe secret key" };
	}

	const auth = await requireAuth();
	if ("error" in auth) return { requireAuth: true };

	const userId = auth.session.sub as string;
	const db = await getDb();
	const user = await db.collection("users").findOne<{
		cart?: { items: { productId: string; variantId: string; quantity: number }[] };
		email?: string;
		name?: string;
		phone?: string;
		stripeCustomerId?: string;
	}>(
		{ _id: new ObjectId(userId) },
		{ projection: { cart: 1, email: 1, name: 1, phone: 1, stripeCustomerId: 1 } },
	);
	const minimal = user?.cart?.items || [];
	if (minimal.length === 0) {
		// Fallback: attempt to import cookie cart (guest cart) on first checkout after signup/login
		try {
			const { getCartId, clearCartId, getCartCookieItems } = await import("@/lib/cart-cookies");
			const [cartId, cookieItems] = await Promise.all([getCartId(), getCartCookieItems()]);
			const aggregated = new Map<string, { productId: string; variantId: string; quantity: number }>();
			if (cookieItems && cookieItems.length > 0) {
				for (const item of cookieItems) {
					const key = item.variantId;
					const current = aggregated.get(key);
					if (current) current.quantity += item.quantity;
					else aggregated.set(key, { ...item });
				}
			}
			if (cartId) {
				const guestCart = commerce.cart.get({ cartId });
				if (guestCart && guestCart.items.length > 0) {
					for (const line of guestCart.items) {
						const key = line.variantId;
						const current = aggregated.get(key);
						if (current) current.quantity += line.quantity;
						else
							aggregated.set(key, {
								productId: line.productId,
								variantId: line.variantId,
								quantity: line.quantity,
							});
					}
				}
			}
			if (aggregated.size > 0) {
				const mergedItems = Array.from(aggregated.values());
				await db
					.collection("users")
					.updateOne(
						{ _id: new ObjectId(userId) },
						{ $set: { cart: { items: mergedItems }, updatedAt: new Date() } },
					);
				await clearCartId();
				return await createCheckoutSession();
			}
		} catch (e) {
			console.warn("Guest cart fallback import failed", e);
		}
		return { error: "Empty cart" };
	}

	const enrichedItems: Cart["items"] = [];
	for (const m of minimal) {
		const resolved = await commerce.variant
			.resolve({ id: m.variantId })
			.catch(async () => commerce.variant.resolve({ id: m.productId }).catch(() => null));
		if (!resolved) continue;
		const { product, variant } = resolved;
		enrichedItems.push({
			id: m.variantId,
			productId: product.id,
			variantId: variant.id,
			quantity: m.quantity,
			price: variant.price || product.price || 0,
			product: { id: product.id, name: product.name, images: product.images, summary: product.summary },
		});
	}
	if (enrichedItems.length === 0) return { error: "Empty cart" };
	const currency = (env.STRIPE_CURRENCY || "USD").toUpperCase();
	const cart: Cart = {
		id: "user-cart",
		items: enrichedItems,
		total: enrichedItems.reduce((s, i) => s + i.price * i.quantity, 0),
		currency: currency.toUpperCase(),
	};

	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });
	const baseUrl = process.env.NEXT_PUBLIC_URL || publicUrl;

	let stripeCustomerId = user?.stripeCustomerId;
	if (!stripeCustomerId && user?.email) {
		try {
			const customer = await stripe.customers.create({
				email: user.email,
				name: user.name,
				phone: user.phone,
				metadata: { userId },
			});
			stripeCustomerId = customer.id;
			await db
				.collection("users")
				.updateOne({ _id: new ObjectId(userId) }, { $set: { stripeCustomerId, updatedAt: new Date() } });
		} catch (e) {
			console.error("Failed to create stripe customer", e);
		}
	}

	const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.items.map((item) => ({
		price: item.variantId || item.productId,
		quantity: item.quantity,
	}));

	try {
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			line_items,
			customer: stripeCustomerId,
			customer_email: !stripeCustomerId ? user?.email : undefined,
			phone_number_collection: user?.phone ? { enabled: true } : undefined,
			metadata: { userId },
			success_url: `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${baseUrl}/?checkout=cancel`,
		});
		if (!session.url) {
			return { error: "Could not create checkout session" };
		}
		return { url: session.url };
	} catch (err) {
		console.error("Error creating checkout session", err);
		return { error: (err as Error).message };
	}
}
