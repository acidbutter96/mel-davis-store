import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { clearCartId, getCartCookieItems, getCartId } from "@/lib/cart-cookies";
import { commerce } from "@/lib/commerce-stripe";
import { ensureIndexes, getDb } from "@/lib/mongodb";

const createUserSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1).optional(),
	password: z.string().min(6),
});

export async function GET() {
	await ensureIndexes();
	const db = await getDb();
	const users = await db
		.collection("users")
		.find({}, { projection: { passwordHash: 0 } })
		.sort({ createdAt: -1 })
		.limit(100)
		.toArray();
	return Response.json(
		users.map((u) => ({
			...u,
			_id: String((u as { _id: unknown })._id),
		})),
	);
}

export async function POST(req: NextRequest) {
	const auth = await requireAuth();
	if ("error" in auth) return auth.error;
	try {
		const body = await req.json();
		const data = createUserSchema.parse(body);
		await ensureIndexes();
		const db = await getDb();

		const existing = await db.collection("users").findOne({ email: data.email.toLowerCase() });
		if (existing) {
			return new Response(JSON.stringify({ error: "Email already registered" }), { status: 409 });
		}

		const now = new Date();
		const passwordHash = await bcrypt.hash(data.password, 10);

		let guestCartItems: { productId: string; variantId: string; quantity: number }[] | undefined;
		const aggregated = new Map<string, { productId: string; variantId: string; quantity: number }>();
		const cookieItems = await getCartCookieItems();
		if (cookieItems && cookieItems.length > 0) {
			for (const item of cookieItems) {
				if (!item) continue;
				const key = item.variantId;
				const current = aggregated.get(key);
				if (current) current.quantity += item.quantity;
				else aggregated.set(key, { ...item });
			}
		}
		try {
			const cartId = await getCartId();
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
		} catch (e) {
			console.warn("[admin user create] Failed to read guest cart", e);
		}
		if (aggregated.size > 0) {
			guestCartItems = Array.from(aggregated.values());
		}

		const userDoc = {
			email: data.email.toLowerCase(),
			name: data.name,
			passwordHash,
			cart: guestCartItems ? { items: guestCartItems } : undefined,
			createdAt: now,
			updatedAt: now,
		};
		const result = await db.collection("users").insertOne(userDoc);

		// Clear guest cart after successful user creation
		try {
			const cartId = await getCartId();
			if (cartId) {
				try {
					await commerce.cart.clear({ cartId });
				} catch {}
				await clearCartId();
			}
		} catch (e) {
			console.warn("[admin user create] Failed to clear guest cart", e);
		}
		return new Response(
			JSON.stringify({
				_id: result.insertedId.toString(),
				email: userDoc.email,
				name: userDoc.name,
				createdAt: now,
				updatedAt: now,
			}),
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof z.ZodError) {
			return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		}
		console.error("[POST /api/users]", err);
		return new Response(JSON.stringify({ error: "Failed to create user" }), { status: 500 });
	}
}
