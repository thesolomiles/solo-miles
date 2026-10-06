/**
 * POST /api/contact — the personal site's "Contact me" form (ui/PersonalSite
 * ContactPage). Mails the message to Leonard from his own Gmail over SMTP, so
 * no third-party form service ever sees his address.
 *
 * Env (Vercel project settings):
 *   GMAIL_USER          the Gmail address (sender and recipient)
 *   GMAIL_APP_PASSWORD  a Google app password (myaccount.google.com/apppasswords)
 */
import nodemailer from 'nodemailer'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function POST(request: Request) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '') // Google shows it in spaced groups
  if (!user || !pass) return json({ ok: false, error: 'not-configured' }, 503)

  const data = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const str = (k: string) => (typeof data?.[k] === 'string' ? (data[k] as string).trim() : '')
  const email = str('email')
  const message = str('message')
  // honeypot: humans never see the field, so pretend it went through
  if (str('website')) return json({ ok: true })
  if (!EMAIL.test(email) || email.length > 160 || !message || message.length > 5000) {
    return json({ ok: false, error: 'invalid' }, 400)
  }

  try {
    await nodemailer
      .createTransport({ service: 'gmail', auth: { user, pass } })
      .sendMail({
        from: `thesolomiles.com <${user}>`,
        to: user,
        replyTo: email,
        subject: `New message from ${email} — thesolomiles.com`,
        text: `${message}\n\n— ${email}`,
      })
  } catch {
    return json({ ok: false, error: 'send-failed' }, 502)
  }
  return json({ ok: true })
}
