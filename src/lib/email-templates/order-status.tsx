type Props = {
	name?: string;
	orderId: string;
	status: string; // generic status message shown at top
	currency?: string; // currency code, e.g. USD
	fulfillment?: { status?: "received" | "producing" | "shipped" } | null;
	items: Array<{
		name: string;
		qty: number;
		unitAmount?: number | null;
		price?: string;
		image?: string | null;
	}>;
	totalCents?: number | null;
	supportEmail?: string;
};

export function orderStatusEmailHtml({
	name,
	orderId,
	status,
	currency,
	fulfillment,
	items,
	totalCents,
	supportEmail,
}: Props) {
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
	function formatCurrency(amountCents?: number | null, currencyCode?: string) {
		try {
			const amount = (amountCents ?? 0) / 100;
			return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(
				amount,
			);
		} catch {
			const a = ((amountCents ?? 0) / 100).toFixed(2);
			return `$${a}`;
		}
	}

	const itemsHtml = (items || [])
		.map((it) => {
			const price = it.unitAmount != null ? formatCurrency(it.unitAmount, currency) : it.price || "";
			const imageHtml = it.image
				? `<td style="width:64px;padding:6px 8px"><img src="${esc(it.image)}" alt="${esc(it.name)}" style="width:56px;height:56px;object-fit:cover;border-radius:6px"/></td>`
				: "";
			return `<tr><td style="padding:8px 0;vertical-align:middle">${imageHtml}<div style="display:inline-block;vertical-align:middle"><div style="font-weight:600">${esc(
				it.name,
			)}</div><div style="font-size:12px;color:#94a3b8">Qty: ${it.qty}</div></div></td><td style="text-align:right">${esc(
				price,
			)}</td></tr>`;
		})
		.join("");
	// Build progress bar HTML if fulfillment status provided
	const steps = ["received", "producing", "shipped"] as const;
	const activeIdx = fulfillment?.status
		? steps.indexOf(fulfillment.status as "received" | "producing" | "shipped")
		: -1;
	const pct = activeIdx >= 0 ? (activeIdx / (steps.length - 1)) * 100 : 0;
	const progressHtml = fulfillment
		? `<div style="margin-top:14px;margin-bottom:8px"><div style="position:relative;height:10px;background:rgba(255,255,255,0.04);border-radius:6px"><div style="position:absolute;left:0;top:0;height:10px;background:#7c3aed;width:${pct}%;border-radius:6px"></div></div><div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-top:6px">${steps
				.map((s) => `<span>${esc(s)}</span>`)
				.join("")}</div></div>`
		: "";

	const formattedTotal = formatCurrency(totalCents ?? null, currency);
	const html =
		`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#0b0b0c;margin:0;padding:20px;color:#e6eef8}.container{max-width:680px;margin:0 auto;background:#0f1113;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.6)}.header{padding:24px;background:linear-gradient(90deg,#2b2b2f,#7c3aed);color:#fff;display:flex;align-items:center;gap:12px}.brand{display:flex;align-items:center;gap:12px}.logo{width:40px;height:40px;flex:0 0 40px}.storename{font-weight:700;font-size:16px;color:#fff}.content{padding:24px;color:#e6eef8}.muted{color:#94a3b8;font-size:13px}.order-table{width:100%;border-collapse:collapse;margin-top:12px}.order-table td{padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03)}.footer{padding:16px 24px;font-size:12px;color:#94a3b8}</style></head><body><div class="container"><div class="header"><div class="brand"><div class="logo">` +
		`<img src="${esc(logoUrl)}" alt="MeldavisStore" style="width:40px;height:40px;border-radius:6px;object-fit:contain" /></div><div class="storename">MeldavisStore</div></div></div><div class="content"><p>Hi${safeName},</p><p>Your order <strong>#${esc(orderId)}</strong> status has been updated to <strong>${esc(status)}</strong>.</p>` +
		progressHtml +
		`<table class="order-table">${itemsHtml}</table><p style="text-align:right;margin-top:12px"><strong>Total: ${esc(formattedTotal)}</strong></p><p>If you have any questions, reply or contact ${support}.</p></div><div class="footer">© ${year} MeldavisStore</div></div></body></html>`;
	return html;
}
