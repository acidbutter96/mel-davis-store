import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { env } from "@/env.mjs";
import { sendEmail } from "./email";
import { orderStatusEmailHtml } from "./email-templates/order-status";
import { getDb } from "./mongodb";

interface NotifyItem {
	name: string | null;
	quantity: number;
	unitAmount?: number | null;
}
interface NotifyPurchase {
	id: string;
	amountTotal?: number;
	currency?: string;
	items?: NotifyItem[];
	fulfillment?: { status?: "received" | "producing" | "shipped" } | null;
}

interface RawPurchaseItem {
	name?: string | null;
	quantity?: number;
	unitAmount?: number | null;
	priceId?: string | null;
}
interface RawPurchase {
	id: string;
	amountTotal?: number;
	currency?: string;
	items?: RawPurchaseItem[];
	fulfillment?: { status?: "received" | "producing" | "shipped" } | null;
}

export async function notifyOrderStatusChange(userId: string, purchaseId: string, status: string) {
	const db = await getDb();
	const users = db.collection("users");
	const user = await users.findOne(
		{ _id: new ObjectId(userId) },
		{ projection: { email: 1, name: 1, purchases: 1 } },
	);
	if (!user || !user.email) return;
	const purchases = (user.purchases || []) as NotifyPurchase[];
	const purchase = purchases.find((p) => p.id === purchaseId) as NotifyPurchase | undefined;

	// Enrich items with product images when possible (use Stripe if configured)
	let enrichedItems: Array<{ name: string; qty: number; unitAmount?: number | null; image?: string | null }> =
		[];
	if (env.STRIPE_SECRET_KEY) {
		try {
			const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined });
			for (const it of purchase?.items || []) {
				const raw = it as RawPurchaseItem;
				let name = raw.name || null;
				let image: string | null = null;
				if (raw.priceId) {
					try {
						const price = await stripe.prices.retrieve(raw.priceId);
						const productId = typeof price.product === "string" ? price.product : price.product?.id;
						if (productId) {
							try {
								const product = await stripe.products.retrieve(productId);
								name = product.name || name;
								image = product.images?.[0] || null;
							} catch (e) {
								/* ignore */
							}
						}
					} catch (e) {
						/* ignore */
					}
				}
				enrichedItems.push({
					name: name || "",
					qty: raw.quantity || 0,
					unitAmount: raw.unitAmount ?? null,
					image,
				});
			}
		} catch (e) {
			// fallback to raw items
		}
	}
	if (enrichedItems.length === 0) {
		enrichedItems = (purchase?.items || []).map((it) => ({
			name: it.name || "",
			qty: it.quantity || 0,
			unitAmount: it.unitAmount ?? null,
			image: null,
		}));
	}

	const rawPurchase = purchase as RawPurchase | undefined;
	const currency = (rawPurchase?.currency || "USD") as string;
	const totalCents = rawPurchase?.amountTotal ?? 0;

	// fetch admin settings to include supportEmail
	const settingsCol = db.collection("settings");
	const settings = await settingsCol.findOne();

	const html = orderStatusEmailHtml({
		name: (user as unknown as { name?: string }).name,
		orderId: purchaseId,
		status,
		currency,
		fulfillment: rawPurchase?.fulfillment ?? null,
		items: enrichedItems,
		totalCents,
		supportEmail: settings?.current?.supportEmail ?? undefined,
	});
	try {
		await sendEmail({
			to: (user as unknown as { email: string }).email,
			subject: `Order #${purchaseId} status updated: ${status}`,
			html,
		});
	} catch (err) {
		console.error("Failed to notify user of order status change", err);
	}
}
