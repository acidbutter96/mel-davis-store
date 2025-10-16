import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
	try {
		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
		const to = typeof body.to === "string" ? body.to : undefined;
		const subject = typeof body.subject === "string" ? body.subject : undefined;
		const text = typeof body.text === "string" ? body.text : undefined;
		const html = typeof body.html === "string" ? body.html : undefined;
		if (!to || !subject || (!text && !html)) {
			return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
		}
		const res = await sendEmail({ to, subject, text, html });
		return new Response(JSON.stringify({ ok: true, id: res.messageId }), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500 });
	}
}
