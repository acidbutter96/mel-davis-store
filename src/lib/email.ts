import 'server-only'
import { env } from '@/env.mjs'

type MailAddress = string | { name?: string; address: string }

export type SendEmailOptions = {
  to: MailAddress | MailAddress[]
  subject: string
  text?: string
  html?: string
  cc?: MailAddress | MailAddress[]
  bcc?: MailAddress | MailAddress[]
  replyTo?: MailAddress
}

let transporter: any | null = null

async function getTransporter() {
  if (transporter) return transporter
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    throw new Error('Missing SMTP configuration')
  }
  const nodemailer = (await import('nodemailer')).default
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })
  return transporter
}

export async function sendEmail(opts: SendEmailOptions) {
  const t = await getTransporter()
  const from = env.SMTP_FROM
  const info = await t.sendMail({ from, ...opts })
  return { messageId: info.messageId }
}
