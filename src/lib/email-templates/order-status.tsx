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
	const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
	const logoUrl = `${baseUrl}/images/meldavis.svg`;
	const itemsHtml = (items || [])
		.map(
			(it) =>
				`<tr><td style="padding:8px 0">${esc(it.name)} x${it.qty}</td><td style="text-align:right">${esc(it.price)}</td></tr>`,
		)
		.join("");
	const html =
		`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#0b0b0c;margin:0;padding:20px;color:#e6eef8}.container{max-width:680px;margin:0 auto;background:#0f1113;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.6)}.header{padding:24px;background:linear-gradient(90deg,#2b2b2f,#7c3aed);color:#fff;display:flex;align-items:center;gap:12px}.brand{display:flex;align-items:center;gap:12px}.logo{width:40px;height:40px;flex:0 0 40px}.storename{font-weight:700;font-size:16px;color:#fff}.content{padding:24px;color:#e6eef8}.muted{color:#94a3b8;font-size:13px}.order-table{width:100%;border-collapse:collapse;margin-top:12px}.order-table td{padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03)}.footer{padding:16px 24px;font-size:12px;color:#94a3b8}</style></head><body><div class="container"><div class="header"><div class="brand"><div class="logo">` +
		`<img src="${esc(logoUrl)}" alt="MeldavisStore" style="width:40px;height:40px;border-radius:6px;object-fit:contain" /></div><div class="storename">MeldavisStore</div></div></div><div class="content"><p>Hi${safeName},</p><p>Your order <strong>#${esc(orderId)}</strong> status has been updated to <strong>${esc(status)}</strong>.</p><table class="order-table">${itemsHtml}</table><p style="text-align:right;margin-top:12px"><strong>Total: ${esc(total)}</strong></p><p>If you have any questions, reply or contact ${support}.</p></div><div class="footer">© ${year} MeldavisStore</div></div></body></html>`;
	return html;
}
