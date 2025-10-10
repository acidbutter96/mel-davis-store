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
	const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
	const logoUrl = `${baseUrl}/images/meldavis.svg`;
	const html =
		`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:#0b0b0c;margin:0;padding:20px;color:#e6eef8}a{color:inherit}.container{max-width:680px;margin:0 auto;background:#0f1113;border-radius:10px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,.6)}.header{padding:20px 24px;background:linear-gradient(90deg,#2b2b2f,#7c3aed);color:#fff;display:flex;align-items:center;gap:12px}.brand{display:flex;align-items:center;gap:12px}.logo{width:56px;height:56px;flex:0 0 56px}.storename{font-weight:700;font-size:18px;color:#ffffff}.content{padding:28px;color:#e6eef8;line-height:1.6}.button{display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none}.muted{color:#94a3b8;font-size:13px}.footer{padding:18px 24px;font-size:13px;color:#94a3b8;background:transparent;text-align:center}</style></head><body><div class="container"><div class="header"><div class="brand"><div class="logo">` +
		`<img src="${esc(logoUrl)}" alt="MeldavisStore" style="width:56px;height:56px;border-radius:6px;object-fit:contain" /></div><div class="storename">MeldavisStore</div></div></div><div class="content"><h2 style="margin-top:0;margin-bottom:8px">Confirm your email</h2><p>Hello${safeName},</p><p>Thanks for joining MeldavisStore. Please confirm your email address to activate your account and receive order updates.</p><p style="text-align:center;margin:20px 0"><a class="button" href="${esc(verifyUrl)}">Verify email</a></p><p>If the button does not work, copy and paste the following link into your browser:</p><p class="muted">${esc(verifyUrl)}</p><p>If you did not create an account, ignore this message or contact support at ${support}.</p></div><div class="footer">© ${year} MeldavisStore</div></div></body></html>`;
	return html;
}
