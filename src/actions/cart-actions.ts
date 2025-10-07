"use server";

import { ObjectId } from "mongodb";
import { env } from "@/env.mjs";
import { requireAuth } from "@/lib/api-auth";
import { clearCartId, getCartCookieItems, getCartId, persistCartSnapshot } from "@/lib/cart-cookies";
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

function toMinimalItems(items: { productId: string; variantId: string; quantity: number }[]): MinimalItem[] {
	const map = new Map<string, MinimalItem>();
	for (const item of items) {
		if (!item) continue;
		const { productId, variantId } = item;
		const quantity = Number.isFinite(item.quantity)
			? item.quantity
			: Number.parseInt(String(item.quantity), 10);
		if (!productId || !variantId || !Number.isFinite(quantity) || quantity <= 0) continue;
		const key = variantId;
		const existing = map.get(key);
		if (existing) existing.quantity += quantity;
		else map.set(key, { productId, variantId, quantity });
	}
	return Array.from(map.values());
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
		const [cookieCartId, cookieItems] = await Promise.all([getCartId(), getCartCookieItems()]);
		if (cookieCartId || (cookieItems && cookieItems.length > 0)) {
			let minimal: MinimalItem[] | null = null;
			let currency = "";
			if (cookieCartId) {
				const cookieCart = commerce.cart.get({ cartId: cookieCartId });
				if (cookieCart && cookieCart.items.length > 0) {
					minimal = toMinimalItems(cookieCart.items);
					currency = cookieCart.currency || "";
					await persistCartSnapshot(cookieCart);
				}
			}
			if ((!minimal || minimal.length === 0) && cookieItems && cookieItems.length > 0) {
				minimal = toMinimalItems(cookieItems);
			}
			if (minimal && minimal.length > 0) {
				await db
					.collection("users")
					.updateOne(
						{ _id: new ObjectId(userId) },
						{ $set: { cart: { items: minimal }, updatedAt: new Date() } },
					);
				if (cookieCartId) {
					try {
						await commerce.cart.clear({ cartId: cookieCartId });
					} catch {}
				}
				await clearCartId();
				const enriched = await enrichItems(minimal, currency);
				return { id: "user-cart", ...enriched };
			}
		}
		return null;
	}
	const cartId = await getCartId();
	if (!cartId) return null;
	try {
		const cart = commerce.cart.get({ cartId });
		if (cart && cart.items.length > 0) {
			await persistCartSnapshot(cart);
			return cart;
		}
		const cookieItems = await getCartCookieItems();
		if (cookieItems && cookieItems.length > 0) {
			const minimal = toMinimalItems(cookieItems);
			if (minimal.length > 0) {
				const enriched = await enrichItems(minimal, "");
				return { id: cartId, ...enriched };
			}
		}
		return null;
	} catch {
		const cookieItems = await getCartCookieItems();
		if (cookieItems && cookieItems.length > 0) {
			const minimal = toMinimalItems(cookieItems);
			if (minimal.length > 0) {
				const enriched = await enrichItems(minimal, "");
				return { id: cartId, ...enriched };
			}
		}
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
	const cartId = await getCartId();
	const cart = await commerce.cart.add({ cartId: cartId || undefined, variantId, quantity });
	await persistCartSnapshot(cart);
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
	const cart = await commerce.cart.update({ cartId, variantId, quantity });
	await persistCartSnapshot(cart);
	return cart;
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
	if (cartId) {
		await commerce.cart.clear({ cartId });
	}
	await clearCartId();
}

export async function getCartItemCount(): Promise<number> {
	const cart = await getCartAction();
	return cart?.items.reduce((s, i) => s + i.quantity, 0) || 0;
}

/**
 * Merge a guest (cookie) cart into the authenticated user's stored cart.
 * - If no user is logged in, it is a no-op.
 * - If user already has items, quantities are summed by variantId.
 * - After merge, the guest cart (in-memory + cookie) is cleared.
 * Returns the merged enriched cart or null if nothing to merge.
 */
export async function mergeGuestCartIntoUser(): Promise<Cart | null> {
	const userId = await getAuthUserId();
	if (!userId) return null;
	const [cookieCartId, cookieItems] = await Promise.all([getCartId(), getCartCookieItems()]);
	if (!cookieCartId && (!cookieItems || cookieItems.length === 0)) return null;
	let guestItems: MinimalItem[] = [];
	let guestCurrency = "";
	if (cookieCartId) {
		const cookieCart = commerce.cart.get({ cartId: cookieCartId });
		if (cookieCart && cookieCart.items.length > 0) {
			guestItems = toMinimalItems(cookieCart.items);
			guestCurrency = cookieCart.currency || "";
		}
	}
	if (guestItems.length === 0 && cookieItems && cookieItems.length > 0) {
		guestItems = toMinimalItems(cookieItems);
	}
	if (guestItems.length === 0) return null;

	const db = await getDb();
	const user = await db
		.collection("users")
		.findOne<{ cart?: { items: MinimalItem[] } }>({ _id: new ObjectId(userId) }, { projection: { cart: 1 } });

	const mergedMap = new Map<string, MinimalItem>();
	for (const existing of user?.cart?.items || []) {
		mergedMap.set(existing.variantId, { ...existing });
	}
	for (const line of guestItems) {
		const key = line.variantId;
		const current = mergedMap.get(key);
		if (current) current.quantity += line.quantity;
		else mergedMap.set(key, { ...line });
	}
	// Remove zero or negative quantities defensively
	const mergedItems = Array.from(mergedMap.values()).filter((i) => i.quantity > 0);

	await db
		.collection("users")
		.updateOne(
			{ _id: new ObjectId(userId) },
			{ $set: { cart: { items: mergedItems }, updatedAt: new Date() } },
		);

	// Clear guest cart (ignore errors)
	try {
		if (cookieCartId) await commerce.cart.clear({ cartId: cookieCartId });
	} catch {}
	await clearCartId();

	const enriched = await enrichItems(mergedItems, guestCurrency);
	return { id: "user-cart", ...enriched };
}
