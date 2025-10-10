type Props = {
	name?: string;
	orderId: string;
	status: string;
	items: Array<{ name: string; qty: number; price: string }>;
	total: string;
	supportEmail?: string;
};

export function orderStatusEmailHtml({ name, orderId, status, items, total, supportEmail }: Props) {
	const esc = (s: unknown) =>
		String(s ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	const year = new Date().getFullYear();
	const safeName = name ? ` ${esc(name)}` : "";
	const support = esc(supportEmail ?? "support@example.com");
	const itemsHtml = (items || [])
		.map(
			(it) =>
				`<tr><td style="padding:8px 0">${esc(it.name)} x${it.qty}</td><td style="text-align:right">${esc(it.price)}</td></tr>`,
		)
		.join("");
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#f6f7fb;margin:0;padding:20px}.container{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(16,24,40,.08)}.header{padding:24px;background:linear-gradient(90deg,#6366f1,#06b6d4);color:#fff;display:flex;align-items:center;gap:12px}.logo{width:40px;height:40px;background:#fff;border-radius:6px;display:inline-block}.content{padding:24px;color:#111827}.muted{color:#6b7280;font-size:13px}.order-table{width:100%;border-collapse:collapse;margin-top:12px}.footer{padding:16px 24px;font-size:12px;color:#9ca3af}</style></head><body><div class="container"><div class="header"><div class="logo"></div><h1 style="margin:0;font-size:18px">Order update</h1></div><div class="content"><p>Hi${safeName},</p><p>Your order <strong>#${esc(orderId)}</strong> status has been updated to <strong>${esc(status)}</strong>.</p><table class="order-table">${itemsHtml}</table><p style="text-align:right;margin-top:12px"><strong>Total: ${esc(total)}</strong></p><p>If you have any questions, reply or contact ${support}.</p></div><div class="footer">© ${year} Your Store</div></div></body></html>`;
	return html;
}
