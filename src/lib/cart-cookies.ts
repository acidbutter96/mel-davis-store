import { cookies } from "next/headers";
import type { Cart } from "@/lib/commerce-types";

export const CART_COOKIE = "yns_cart_id";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export interface CartCookieItem {
	productId: string;
	variantId: string;
	quantity: number;
}

interface CartCookiePayload {
	id: string;
	items?: CartCookieItem[];
}

function sanitizeItems(raw: unknown): CartCookieItem[] | undefined {
	if (!raw || !Array.isArray(raw)) return undefined;
	const deduped = new Map<string, CartCookieItem>();
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const productId =
			typeof (entry as { productId?: unknown }).productId === "string"
				? (entry as { productId: string }).productId.trim()
				: "";
		const variantId =
			typeof (entry as { variantId?: unknown }).variantId === "string"
				? (entry as { variantId: string }).variantId.trim()
				: "";
		const quantityRaw = (entry as { quantity?: unknown }).quantity;
		const quantity = Number.parseInt(String(quantityRaw ?? 0), 10);
		if (!productId || !variantId || !Number.isFinite(quantity) || quantity <= 0) continue;
		const existing = deduped.get(variantId);
		if (existing) existing.quantity += quantity;
		else deduped.set(variantId, { productId, variantId, quantity });
	}
	if (deduped.size === 0) return undefined;
	return Array.from(deduped.values());
}

function parseCartCookie(raw: string | undefined): CartCookiePayload | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		const parsed = JSON.parse(trimmed) as { id?: unknown; items?: unknown };
		if (parsed && typeof parsed.id === "string" && parsed.id) {
			const items = sanitizeItems(parsed.items);
			return items ? { id: parsed.id, items } : { id: parsed.id };
		}
	} catch (error) {
		// Mantém compatibilidade com o formato antigo (string simples)
	}
	return { id: trimmed };
}

export async function getCartCookiePayload(): Promise<CartCookiePayload | null> {
	try {
		const raw = (await cookies()).get(CART_COOKIE)?.value;
		return parseCartCookie(raw) ?? null;
	} catch (error) {
		console.error("Failed to read cart cookie payload", error);
		return null;
	}
}

export async function getCartId(): Promise<string | null> {
	const payload = await getCartCookiePayload();
	return payload?.id ?? null;
}

export async function getCartCookieItems(): Promise<CartCookieItem[] | null> {
	const payload = await getCartCookiePayload();
	return payload?.items ?? null;
}

export async function setCartId(cartId: string, items?: CartCookieItem[]): Promise<void> {
	try {
		const sanitized = sanitizeItems(items) ?? undefined;
		const payload: CartCookiePayload =
			sanitized && sanitized.length > 0 ? { id: cartId, items: sanitized } : { id: cartId };
		(await cookies()).set(CART_COOKIE, JSON.stringify(payload), {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: CART_COOKIE_MAX_AGE,
			path: "/",
		});
	} catch (error) {
		console.error("Failed to set cart ID cookie", error);
	}
}

export async function persistCartSnapshot(
	cart: Pick<Cart, "id" | "items"> | null | undefined,
): Promise<void> {
	if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
		await clearCartId();
		return;
	}
	const minimal = cart.items
		.map((item) => ({
			productId: item.productId,
			variantId: item.variantId,
			quantity: item.quantity,
		}))
		.filter(
			(item) =>
				typeof item.productId === "string" &&
				typeof item.variantId === "string" &&
				Number.isFinite(item.quantity) &&
				item.quantity > 0,
		);
	if (minimal.length === 0) {
		await clearCartId();
		return;
	}
	await setCartId(cart.id, minimal);
}

export async function clearCartId(): Promise<void> {
	try {
		(await cookies()).set(CART_COOKIE, "", {
			maxAge: 0,
			path: "/",
		});
	} catch (error) {
		console.error("Failed to clear cart ID cookie", error);
	}
}
