"use server";

import { ObjectId } from "mongodb";
import { env } from "@/env.mjs";
import { requireAuth } from "@/lib/api-auth";
import { clearCartId, getCartId, setCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";
import type { Cart } from "@/lib/commerce-types";
import { getDb } from "@/lib/mongodb";

interface MinimalItem {
	productId: string;
	variantId: string;
	quantity: number;
}

async function getAuthUserId(): Promise<string | null> {
	const auth = await requireAuth();
	if ("error" in auth) return null;
	return auth.session.sub as string;
}

async function enrichItems(
	minimal: MinimalItem[],
	currencyFallback: string,
): Promise<{ items: Cart["items"]; total: number; currency: string }> {
	const items: Cart["items"] = [];
	let currency = currencyFallback;
	for (const m of minimal) {
		const resolved = await commerce.variant
			.resolve({ id: m.variantId })
			.catch(async () => commerce.variant.resolve({ id: m.productId }).catch(() => null));
		if (!resolved) continue;
		const { product: prod, variant } = resolved;
		if (!currency) currency = prod.currency;
		const price = variant.price || prod.price || 0;
		items.push({
			id: m.variantId,
			productId: prod.id,
			variantId: variant.id,
			quantity: m.quantity,
			price,
			product: { id: prod.id, name: prod.name, images: prod.images, summary: prod.summary },
		});
	}
	const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
	return { items, total, currency: (currency || env.STRIPE_CURRENCY || "USD").toUpperCase() };
}

export async function getCartAction(): Promise<Cart | null> {
	const userId = await getAuthUserId();
	if (userId) {
		const db = await getDb();
		const user = await db
			.collection("users")
			.findOne<{ cart?: { items: MinimalItem[] } }>(
				{ _id: new ObjectId(userId) },
				{ projection: { cart: 1 } },
			);
		if (user?.cart?.items && user.cart.items.length > 0) {
			const enriched = await enrichItems(user.cart.items, "");
			return { id: "user-cart", ...enriched };
		}
		const cookieCartId = await getCartId();
		if (cookieCartId) {
			const cookieCart = commerce.cart.get({ cartId: cookieCartId });
			if (cookieCart && cookieCart.items.length > 0) {
				const minimal: MinimalItem[] = cookieCart.items.map((i) => ({
					productId: i.productId,
					variantId: i.variantId,
					quantity: i.quantity,
				}));
				await db
					.collection("users")
					.updateOne(
						{ _id: new ObjectId(userId) },
						{ $set: { cart: { items: minimal }, updatedAt: new Date() } },
					);
				await clearCartId();
				const enriched = await enrichItems(minimal, cookieCart.currency || "");
				return { id: "user-cart", ...enriched };
			}
		}
		return null;
	}
	const cartId = await getCartId();
	if (!cartId) return null;
	try {
		return commerce.cart.get({ cartId });
	} catch {
		return null;
	}
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<Cart | null> {
	const userId = await getAuthUserId();
	if (userId) {
		const db = await getDb();
		const user = await db
			.collection("users")
			.findOne<{ cart?: { items: MinimalItem[] } }>(
				{ _id: new ObjectId(userId) },
				{ projection: { cart: 1 } },
			);
		const items: MinimalItem[] = [...(user?.cart?.items || [])];
		let entry = items.find((i) => i.variantId === variantId);
		if (!entry) {
			entry = { productId: variantId, variantId, quantity: 0 };
			items.push(entry);
		}
		entry.quantity += quantity;
		if (entry.quantity <= 0) items.splice(items.indexOf(entry), 1);
		await db
			.collection("users")
			.updateOne({ _id: new ObjectId(userId) }, { $set: { cart: { items }, updatedAt: new Date() } });
		const enriched = await enrichItems(items, "");
		return { id: "user-cart", ...enriched };
	}
	let cartId = await getCartId();
	const cart = await commerce.cart.add({ cartId: cartId || undefined, variantId, quantity });
	if (!cartId && cart.id) await setCartId(cart.id);
	return cart;
}

export async function updateCartItemAction(variantId: string, quantity: number): Promise<Cart | null> {
	const userId = await getAuthUserId();
	if (userId) {
		const db = await getDb();
		const user = await db
			.collection("users")
			.findOne<{ cart?: { items: MinimalItem[] } }>(
				{ _id: new ObjectId(userId) },
				{ projection: { cart: 1 } },
			);
		if (!user?.cart?.items) return null;
		const items = [...user.cart.items];
		const idx = items.findIndex((i) => i.variantId === variantId);
		if (idx === -1) return await getCartAction();
		if (quantity <= 0) items.splice(idx, 1);
		else items[idx]!.quantity = quantity;
		await db
			.collection("users")
			.updateOne({ _id: new ObjectId(userId) }, { $set: { cart: { items }, updatedAt: new Date() } });
		const enriched = await enrichItems(items, "");
		return { id: "user-cart", ...enriched };
	}
	const cartId = await getCartId();
	if (!cartId) return null;
	return commerce.cart.update({ cartId, variantId, quantity });
}

export async function removeFromCartAction(variantId: string): Promise<Cart | null> {
	return updateCartItemAction(variantId, 0);
}

export async function clearCartAction(): Promise<void> {
	const userId = await getAuthUserId();
	if (userId) {
		const db = await getDb();
		await db
			.collection("users")
			.updateOne({ _id: new ObjectId(userId) }, { $unset: { cart: "" }, $set: { updatedAt: new Date() } });
		return;
	}
	const cartId = await getCartId();
	if (!cartId) return;
	await commerce.cart.clear({ cartId });
	await clearCartId();
}

export async function getCartItemCount(): Promise<number> {
	const cart = await getCartAction();
	return cart?.items.reduce((s, i) => s + i.quantity, 0) || 0;
}
