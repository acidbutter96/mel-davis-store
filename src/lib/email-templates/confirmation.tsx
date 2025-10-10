type Props = {
	name?: string;
	verifyUrl: string;
	supportEmail?: string;
};

export function confirmationEmailHtml({ name, verifyUrl, supportEmail }: Props) {
	const esc = (s: unknown) =>
		String(s ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	const year = new Date().getFullYear();
	const safeName = name ? ` ${esc(name)}` : "";
	const support = esc(supportEmail ?? "support@example.com");
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#f6f7fb;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(16,24,40,.08)}.header{padding:24px;background:linear-gradient(90deg,#6366f1,#06b6d4);color:#fff}.content{padding:24px;color:#111827}.button{display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none}.muted{color:#6b7280;font-size:13px}.footer{padding:16px 24px;font-size:12px;color:#9ca3af}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;font-size:20px">Confirm your email</h1></div><div class="content"><p>Hello${safeName},</p><p>Thank you for creating an account. Please confirm your email address to activate your account.</p><p style="text-align:center"><a class="button" href="${esc(verifyUrl)}">Verify email</a></p><p>If the button does not work, copy and paste the following link into your browser:</p><p class="muted">${esc(verifyUrl)}</p><p>If you did not create an account, ignore this message or contact support at ${support}.</p></div><div class="footer">© ${year} Your Store</div></div></body></html>`;
	return html;
}
