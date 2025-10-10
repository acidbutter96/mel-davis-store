import "server-only";
import type { Collection, Document } from "mongodb";
import { env } from "@/env.mjs";
import { getMongoClient } from "@/lib/mongodb";

type MailAddress = string | { name?: string; address: string };

export type SendEmailOptions = {
	to: MailAddress | MailAddress[];
	subject: string;
	text?: string;
	html?: string;
	cc?: MailAddress | MailAddress[];
	bcc?: MailAddress | MailAddress[];
	replyTo?: MailAddress;
};

type MinimalTransporter = { sendMail: (opts: Record<string, unknown>) => Promise<{ messageId?: string }> };
let transporter: MinimalTransporter | null = null;

async function getTransporter() {
	if (transporter) return transporter;
	if (!env.SMTP_HOST || !env.SMTP_FROM) {
		throw new Error("Missing SMTP_HOST or SMTP_FROM configuration");
	}
	const nodemailer = (await import("nodemailer")).default;
	const transportOpts: Record<string, unknown> = {
		host: env.SMTP_HOST,
		port: env.SMTP_PORT ?? 587,
		secure: (env.SMTP_PORT ?? 587) === 465,
	};
	if (env.SMTP_USER && env.SMTP_PASS) transportOpts.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS };
	transporter = nodemailer.createTransport(transportOpts);
	return transporter;
}

export async function sendEmail(opts: SendEmailOptions) {
	let info: { messageId?: string } | null = null;
	let sendError: string | null = null;
	let persistenceError: string | null = null;
	try {
		const t = (await getTransporter()) as MinimalTransporter;
		const from = env.SMTP_FROM;
		try {
			info = await t.sendMail({ from, ...opts });
		} catch (err: unknown) {
			sendError = err instanceof Error ? err.message : String(err);
		}
	} catch (err: unknown) {
		sendError = err instanceof Error ? err.message : String(err);
	}
	try {
		const client = await getMongoClient();
		const commDb = client.db("communication");
		const coll: Collection<Document> = commDb.collection("emails");
		const sentAt = new Date();
		const html = opts.html ?? opts.text ?? "";
		const recipients: string[] = [];
		function extract(addr: MailAddress | MailAddress[] | undefined) {
			if (!addr) return;
			if (Array.isArray(addr)) {
				for (const a of addr) extract(a);
				return;
			}
			if (typeof addr === "string") {
				recipients.push(addr.toLowerCase());
				return;
			}
			if (addr.address) recipients.push(String(addr.address).toLowerCase());
		}
		extract(opts.to);
		extract(opts.cc);
		extract(opts.bcc);
		for (const email of recipients) {
			try {
				await coll.updateOne(
					{ email },
					[
						{
							$set: {
								lastSent: sentAt,
								messages: { $concatArrays: [[html], { $ifNull: ["$messages", []] }] },
							},
						},
					],
					{ upsert: true },
				);
			} catch (err: unknown) {
				persistenceError = err instanceof Error ? err.message : String(err);
			}
		}
	} catch (err: unknown) {
		persistenceError = err instanceof Error ? err.message : String(err);
	}
	return {
		messageId: info?.messageId,
		sent: !sendError,
		error: sendError ?? undefined,
		persistenceError: persistenceError ?? undefined,
	} as {
		messageId?: string | undefined;
		sent: boolean;
		error?: string | undefined;
		persistenceError?: string | undefined;
	};
}
