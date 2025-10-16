type Props = { title: string; bodyHtml: string; supportEmail?: string };

export function transactionalEmailHtml({ title, bodyHtml, supportEmail }: Props) {
	const esc = (s: unknown) =>
		String(s ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	const year = new Date().getFullYear();
	const support = esc(supportEmail ?? "support@example.com");
	const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
	const logoUrl = `${baseUrl}/images/meldavis.svg`;
	const html =
		`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#0b0b0c;margin:0;padding:20px;color:#e6eef8}a{color:inherit}.container{max-width:680px;margin:0 auto;background:#0f1113;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.6)}.header{padding:24px;background:linear-gradient(90deg,#2b2b2f,#7c3aed);color:#fff;display:flex;align-items:center;gap:12px}.brand{display:flex;align-items:center;gap:12px}.logo{width:40px;height:40px;flex:0 0 40px}.storename{font-weight:700;font-size:16px;color:#fff}.content{padding:24px;color:#e6eef8}.muted{color:#94a3b8;font-size:13px}.footer{padding:16px 24px;font-size:12px;color:#94a3b8}</style></head><body><div class="container"><div class="header"><div class="brand"><div class="logo">` +
		`<img src="${esc(logoUrl)}" alt="MeldavisStore" style="width:40px;height:40px;border-radius:6px;object-fit:contain" /></div><div class="storename">MeldavisStore</div></div></div><div class="content">${bodyHtml}<p style="margin-top:12px">If you need help, contact ${support}</p></div><div class="footer">© ${year} MeldavisStore</div></div></body></html>`;
	return html;
}
