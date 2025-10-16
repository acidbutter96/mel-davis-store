import { nanoid } from "nanoid";
import { env } from "@/env.mjs";
import { getDb } from "@/lib/mongodb";

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as { email?: string };
		const email = String(body?.email || "")
			.trim()
			.toLowerCase();
		if (!email) return new Response(JSON.stringify({ ok: true }), { status: 200 });

		const db = await getDb();
		const user = await db.collection("users").findOne({ email });
		let token = undefined;
		if (user) {
			token = nanoid(48);
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
			await db
				.collection("users")
				.updateOne({ _id: user._id }, { $set: { passwordReset: { token, expiresAt } } });
			// Only attempt to send email in non-test environments or when emailing is enabled
			if (process.env.NODE_ENV !== "test" && process.env.SKIP_EMAILS !== "1") {
				try {
					const { passwordResetEmailHtml } = await import("@/lib/email-templates/password-reset");
					const resetUrl = new URL(
						"/reset-password",
						process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
					).toString();
					const html = passwordResetEmailHtml({
						name: user.name || "",
						resetUrl: `${resetUrl}?token=${token}`,
						supportEmail: env.SMTP_USER,
					});
					const { sendEmail } = await import("@/lib/email");
					await sendEmail({
						to: user.email,
						subject: "Reset your password",
						text: `${resetUrl}?token=${token}`,
						html,
					});
				} catch (err) {
					console.error("Failed to send password reset email", err);
				}
			} else {
				console.info("Skipping sending password reset email in test or disabled email environment");
			}
		}
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	}
}
