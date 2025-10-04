"use server";

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { env } from "@/env.mjs";
import { getCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";

// Creates a Stripe checkout session from the current cart and returns a redirect URL.
export async function createCheckoutSession(): Promise<
	{ url: string } | { error: string } | { requireAuth: true }
> {
	if (!env.STRIPE_SECRET_KEY) {
		return { error: "Missing Stripe secret key" };
	}

	// Auth check via JWT cookie
	try {
		const cookieStore = await cookies();
		const token = cookieStore.get("auth_token")?.value;
		if (!token) return { requireAuth: true };
		await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET));
	} catch {
		return { requireAuth: true };
	}
	const cartId = await getCartId();
	if (!cartId) {
		return { error: "Empty cart" };
	}

	const cart = await commerce.cart.get({ cartId });
	if (!cart || cart.items.length === 0) {
		return { error: "Empty cart" };
	}

	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });

	// Attempt to use variantId (Price) directly; fallback to productId if needed.
	const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.items.map((item) => ({
		price: item.variantId || item.productId,
		quantity: item.quantity,
		// Se variantId não for um price válido, Stripe vai falhar e poderemos ajustar depois.
	}));

	try {
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			line_items,
			success_url: `${process.env.NEXT_PUBLIC_URL}/?checkout=success`,
			cancel_url: `${process.env.NEXT_PUBLIC_URL}/?checkout=cancel`,
			// Poderíamos adicionar shipping_address_collection, tax details, etc.
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
