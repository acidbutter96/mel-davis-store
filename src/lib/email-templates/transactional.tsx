type Props = { title: string; bodyHtml: string; supportEmail?: string };

export function transactionalEmailHtml({ title, bodyHtml, supportEmail }: Props) {
	const esc = (s: unknown) =>
		String(s ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	const year = new Date().getFullYear();
	const support = esc(supportEmail ?? "support@example.com");
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#f6f7fb;margin:0;padding:20px}.container{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(16,24,40,.08)}.header{padding:24px;background:linear-gradient(90deg,#6366f1,#06b6d4);color:#fff;display:flex;align-items:center;gap:12px}.logo{width:40px;height:40px;background:#fff;border-radius:6px;display:inline-block}.content{padding:24px;color:#111827}.muted{color:#6b7280;font-size:13px}.footer{padding:16px 24px;font-size:12px;color:#9ca3af}</style></head><body><div class="container"><div class="header"><div class="logo"></div><h1 style="margin:0;font-size:18px">${esc(title)}</h1></div><div class="content">${bodyHtml}<p style="margin-top:12px">If you need help, contact ${support}</p></div><div class="footer">© ${year} Your Store</div></div></body></html>`;
	return html;
}
