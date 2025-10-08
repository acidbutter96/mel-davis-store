import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { z } from "zod";
import { env } from "@/env.mjs";
import { getCartCookieItems, getCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";
import { ensureIndexes, getDb } from "@/lib/mongodb";
import { createPersistentSession } from "@/lib/session";


const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	name: z.string().min(1),
	phone: z.string().min(6).optional(),
	address: z
		.object({
			line1: z.string().min(1).optional(),
			line2: z.string().optional(),
			city: z.string().min(1).optional(),
			state: z.string().optional(),
			postalCode: z.string().optional(),
			country: z
				.string()
				.min(2)
				.max(64)
				.transform((v) => v.trim().toUpperCase())
				.optional(),
		})
		.optional(),
	cart: z
		.object({
			items: z.array(
				z.object({
					productId: z.string().min(1),
					variantId: z.string().min(1),
					quantity: z.number().int().min(1),
				}),
			),
		})
		.optional(),
	cartItems: z
		.array(
			z.object({
				productId: z.string().min(1),
				variantId: z.string().min(1),
				quantity: z.number().int().min(1),
			}),
		)
		.optional(),
});

function getJwtSecretKey() {
	return new TextEncoder().encode(env.JWT_SECRET);
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const data = registerSchema.parse(body);
		console.debug("[register] payload.cartItems", data.cartItems);
		console.debug("[register] payload.cart", data.cart?.items?.length || 0);
		await ensureIndexes();
		const db = await getDb();

		const emailLower = data.email.toLowerCase();
		const existing = await db.collection("users").findOne({ email: emailLower });
		if (existing) {
			return new Response(JSON.stringify({ error: "Email already registered" }), { status: 409 });
		}

		const passwordHash = await bcrypt.hash(data.password, 10);
		const now = new Date();

		let mergedCartItems: { productId: string; variantId: string; quantity: number }[] | undefined;
		const incoming: { productId: string; variantId: string; quantity: number }[] = [];
		if (data.cart?.items && data.cart.items.length > 0) incoming.push(...data.cart.items);
		if (data.cartItems && data.cartItems.length > 0) incoming.push(...data.cartItems);
		const map = new Map<string, { productId: string; variantId: string; quantity: number }>();
		for (const it of incoming) {
			const existingItem = map.get(it.variantId);
			if (existingItem) existingItem.quantity += it.quantity;
			else map.set(it.variantId, { ...it });
		}
		const cookieItems = await getCartCookieItems();
		if (cookieItems && cookieItems.length > 0) {
			for (const item of cookieItems) {
				const existing = map.get(item.variantId);
				if (existing) existing.quantity += item.quantity;
				else map.set(item.variantId, { ...item });
			}
			console.debug("[register] merged with cookie snapshot", cookieItems.length);
		}
		try {
			const cartId = await getCartId();
			if (cartId) {
				const guestCart = commerce.cart.get({ cartId });
				if (guestCart && guestCart.items.length > 0) {
					for (const g of guestCart.items) {
						const existing = map.get(g.variantId);
						if (existing) existing.quantity += g.quantity;
						else
							map.set(g.variantId, {
								productId: g.productId,
								variantId: g.variantId,
								quantity: g.quantity,
							});
					}
					console.debug("[register] merged with guestCart", guestCart.items.length);
				}
			}
		} catch (e) {
			console.warn("[register] Failed to read guest cart", e);
		}

		if (map.size > 0) {
			mergedCartItems = Array.from(map.values()).filter((i) => i.quantity > 0);
			console.debug("[register] final mergedCartItems", mergedCartItems);
		}

		const userDoc = {
			email: emailLower,
			name: data.name,
			phone: data.phone,
			address: data.address,
			passwordHash,
			cart: mergedCartItems ? { items: mergedCartItems } : undefined,
			createdAt: now,
			updatedAt: now,
		};

		const res = await db.collection("users").insertOne(userDoc);
		console.debug("[register] user inserted with cart?", Boolean(userDoc.cart));

		const userId = res.insertedId.toString();
		await createPersistentSession({ id: userId, email: emailLower, name: data.name });
		const legacyToken = await new SignJWT({ sub: userId, email: emailLower })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("7d")
			.sign(getJwtSecretKey());
		return new Response(
			JSON.stringify({
				token: legacyToken,
				user: { _id: userId, email: emailLower, name: data.name },
				autoLoggedIn: true,
			}),
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof z.ZodError) {
			return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		}
		console.error("[POST /api/auth/register]", err);
		return new Response(JSON.stringify({ error: "Failed to register" }), { status: 500 });
	}
}
