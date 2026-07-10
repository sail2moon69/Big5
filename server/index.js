/* global fetch */
const express = require('express')

const PORT = process.env.PORT || 4001
const BREVO_API_KEY = process.env.BREVO_API_KEY
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Big Five Test | rd-sim.de'

const MAX_RECIPIENTS = 200
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const payload = {
    sender: { email: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
    to: [{ email, name }],
    subject: 'Ihre persönliche Einladung zum Big Five Test',
    textContent: buildEmailBody(name, link)
  }
  if (ccEmail) {
    payload.cc = [{ email: ccEmail }]
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Brevo API error ${response.status}: ${errorBody}`)
  }
}

app.post('/send-invites', async (req, res) => {
  if (!BREVO_API_KEY || !MAIL_FROM_ADDRESS) {
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
  res.json({ ok: true, configured: Boolean(BREVO_API_KEY && MAIL_FROM_ADDRESS) })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`big5-invite-api listening on 127.0.0.1:${PORT}`)
})
