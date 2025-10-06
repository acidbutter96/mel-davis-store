import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/env.mjs";
import { requireAuth } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	if (!env.STRIPE_SECRET_KEY) {
		return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
	}
	const auth = await requireAuth();
	if ("error" in auth) return auth.error; // 401

	const { id } = params;
	if (!id || !id.startsWith("cs_")) {
		return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
	}

	const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });
	try {
		const session = await stripe.checkout.sessions.retrieve(id, {
			expand: ["line_items.data.price.product"],
		});

		if (session.metadata?.userId && session.metadata.userId !== String(auth.session.sub)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const items = (session.line_items?.data || []).map((li) => {
			let prod: { id: string; name: string; images?: string[] } | null = null;
			if (li.price?.product && typeof li.price.product === "object") {
				const p = li.price.product as Stripe.Product;
				prod = { id: p.id, name: p.name, images: p.images };
			}
			return {
				quantity: li.quantity,
				priceId: li.price?.id,
				unitAmount: li.price?.unit_amount,
				currency: li.price?.currency?.toUpperCase(),
				product: prod,
			};
		});

		return NextResponse.json({
			id: session.id,
			paymentStatus: session.payment_status,
			status: session.status,
			amountTotal: session.amount_total,
			currency: session.currency?.toUpperCase(),
			customerEmail: session.customer_details?.email || session.customer_email,
			items,
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 400 });
	}
}
