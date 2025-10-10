import { ObjectId } from "mongodb";
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
	items?: NotifyItem[];
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
	const items = (purchase?.items || []).map((it) => ({
		name: it.name || "",
		qty: it.quantity || 0,
		price: it.unitAmount != null ? (it.unitAmount / 100).toFixed(2) : "0.00",
	}));
	const total = purchase?.amountTotal ? (purchase.amountTotal / 100).toFixed(2) : "0.00";
	const html = orderStatusEmailHtml({
		name: (user as unknown as { name?: string }).name,
		orderId: purchaseId,
		status,
		items,
		total,
		supportEmail: undefined,
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
