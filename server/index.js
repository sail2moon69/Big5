const express = require('express')
const nodemailer = require('nodemailer')

const PORT = process.env.PORT || 4001
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASSWORD = process.env.SMTP_PASSWORD
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Big Five Test | rd-sim.de'

const MAX_RECIPIENTS = 200
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isConfigured () {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD && MAIL_FROM_ADDRESS)
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined
})

const app = express()
app.use(express.json({ limit: '256kb' }))

function isValidEmail (value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim())
}

function buildEmailBody (name, link) {
  return [
    `Hallo ${name},`,
    '',
    'Sie wurden zum Big Five Persönlichkeitstest eingeladen.',
    '',
    `Ihr persönlicher Link: ${link}`,
    '',
    'Der Test dauert etwa 15-20 Minuten. Ihre Antworten werden ausschließlich in Ihrem Browser verarbeitet, es findet keine Speicherung auf einem Server statt.',
    '',
    'Viele Grüße',
    'rd-sim.de'
  ].join('\n')
}

async function sendEmail ({ name, email, link, ccEmail }) {
  await transporter.sendMail({
    from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`,
    to: `"${name}" <${email}>`,
    cc: ccEmail || undefined,
    subject: 'Ihre persönliche Einladung zum Big Five Test',
    text: buildEmailBody(name, link)
  })
}

app.post('/send-invites', async (req, res) => {
  if (!isConfigured()) {
    res.status(500).json({ error: 'Mail service is not configured on the server' })
    return
  }

  const { recipients, ccEmail } = req.body || {}
  if (!Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'recipients must be a non-empty array' })
    return
  }
  if (recipients.length > MAX_RECIPIENTS) {
    res.status(400).json({ error: `Too many recipients (max ${MAX_RECIPIENTS})` })
    return
  }
  if (ccEmail && !isValidEmail(ccEmail)) {
    res.status(400).json({ error: 'ccEmail is not a valid email address' })
    return
  }

  const results = []
  for (const recipient of recipients) {
    const { name, email, link } = recipient || {}
    if (!name || !isValidEmail(email) || !link) {
      results.push({ name, email, status: 'skipped', reason: 'invalid name, email, or link' })
      continue
    }
    try {
      await sendEmail({ name, email: email.trim(), link, ccEmail })
      results.push({ name, email, status: 'sent' })
    } catch (error) {
      results.push({ name, email, status: 'failed', reason: error.message })
    }
  }

  res.json({ results })
})

app.get('/health', (req, res) => {
  res.json({ ok: true, configured: isConfigured() })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`big5-invite-api listening on 127.0.0.1:${PORT}`)
})
