"use server";

import Stripe from "stripe";
import { env } from "@/env.mjs";
import { getCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";

// Cria uma sessão de checkout Stripe a partir do carrinho atual.
// Retorna a URL de redirecionamento.
export async function createCheckoutSession(): Promise<{ url: string } | { error: string }> {
	if (!env.STRIPE_SECRET_KEY) {
		return { error: "Stripe secret key ausente" };
	}
	const cartId = await getCartId();
	if (!cartId) {
		return { error: "Carrinho vazio" };
	}

	const cart = await commerce.cart.get({ cartId });
	if (!cart || cart.items.length === 0) {
		return { error: "Carrinho vazio" };
	}

	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });

	// Tentamos usar variantId (Price) diretamente; fallback para productId se necessário.
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
			return { error: "Não foi possível criar sessão de checkout" };
		}
		return { url: session.url };
	} catch (err) {
		console.error("Erro criando sessão de checkout", err);
		return { error: (err as Error).message };
	}
}
