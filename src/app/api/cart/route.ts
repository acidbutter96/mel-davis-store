import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env.mjs";
import { getUserIdFromAuthHeader } from "@/lib/api-auth-helpers";
import { commerce } from "@/lib/commerce-stripe";
import type { Cart } from "@/lib/commerce-types";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

async function getAuthenticatedUserId(): Promise<string | null> {
	let userId = await getUserIdFromAuthHeader();
	if (!userId) {
		try {
			const sessionToken = (await cookies()).get("session")?.value;
			if (sessionToken) {
				const { decrypt } = await import("@/lib/session");
				const data = await decrypt(sessionToken);
				if (data && data.expires > Date.now()) userId = data.user.id;
			}
		} catch {}
	}
	return userId;
}

async function enrich(
	minimal: { productId: string; variantId: string; quantity: number }[],
): Promise<{ items: Cart["items"]; total: number; currency: string }> {
	const items: Cart["items"] = [];
	let currency = (env.STRIPE_CURRENCY || "USD").toUpperCase();
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
	return { items, total, currency };
}

export async function GET() {
	try {
		const userId = await getAuthenticatedUserId();
		if (!userId) return NextResponse.json({ cart: null }, { status: 200 });

		const db = await getDb();
		const { ObjectId } = await import("mongodb");
		const user = await db
			.collection("users")
			.findOne<{ cart?: { items: { productId: string; variantId: string; quantity: number }[] } }>(
				{ _id: new ObjectId(userId) },
				{ projection: { cart: 1 } },
			);
		const minimal = user?.cart?.items || [];
		if (minimal.length === 0) {
			return NextResponse.json({
				cart: {
					items: [],
					total: 0,
					currency: (env.STRIPE_CURRENCY || "USD").toUpperCase(),
				},
			});
		}
		const enriched = await enrich(minimal);

		console.log(enriched);
		return NextResponse.json({ cart: enriched });
	} catch (error) {
		console.error("GET /api/cart error", error);
		return NextResponse.json({ error: "Failed to load cart" }, { status: 500 });
	}
}
