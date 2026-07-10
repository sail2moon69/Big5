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
app.use(express.json({ limit: '20mb' }))

function isValidEmail (value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim())
}

function escapeHtml (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailText (name, link) {
  return [
    `Hallo ${name},`,
    '',
    'Sie wurden zum Big Five Persönlichkeitstest eingeladen.',
    '',
    `Ihr persönlicher Link: ${link}`,
    '',
    'Über den Test',
    'Der Big-Five-Persönlichkeitstest misst fünf zentrale Persönlichkeitsdimensionen: Neurotizismus, Extraversion, Offenheit für Erfahrungen, Verträglichkeit und Gewissenhaftigkeit. Er basiert auf dem wissenschaftlich etablierten Fünf-Faktoren-Modell.',
    '',
    'Warum das für Führungskräfte im Rettungsdienst wichtig ist',
    'In Einsatzlagen mit hohem Zeit- und Handlungsdruck hängt der Erfolg der Einsatzleitung nicht nur von Fachwissen ab, sondern auch von der eigenen Persönlichkeit. Wer die eigenen Reaktionsmuster auf Stress kennt, kann Entscheidungen bewusster treffen, im Team klarer kommunizieren und auch unter Druck handlungsfähig bleiben.',
    '',
    'Ablauf & Regeln',
    '- Antworten Sie ehrlich, auch wenn Ihnen eine Antwort nicht gefällt.',
    '- Beschreiben Sie sich so, wie Sie aktuell tatsächlich sind, nicht wie Sie gerne wären.',
    '- Die erste, spontane Reaktion ist meist die zutreffendste.',
    '- Planen Sie ca. 15-20 Minuten ein und beantworten Sie den Test möglichst am Stück.',
    '',
    'Nach dem Test',
    'Die Ergebnisse werden im Rahmen des Kurses ausführlich besprochen. Drucken Sie sich Ihren PDF-Report nach Abschluss des Tests daher am besten aus und bringen Sie ihn zum Kurs mit.',
    '',
    'Datenschutz: Der Test läuft vollständig in Ihrem Browser. Es gibt keine Serverspeicherung und keine Übermittlung an Dritte - niemand außer Ihnen sieht Ihre Antworten oder Ihr Ergebnis.',
    '',
    'Viele Grüße',
    'rd-sim.de'
  ].join('\n')
}

function buildEmailHtml (name, link) {
  const safeName = escapeHtml(name)
  const safeLink = escapeHtml(link)
  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background-color:#f4f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;max-width:600px;width:100%;">
          <tr>
            <td style="padding:0;line-height:0;">
              <img src="https://big5.rd-sim.de/static/hero.jpg" width="600" height="150" alt="" style="display:block;width:100%;height:150px;object-fit:cover;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#0a0e1a;padding:20px 32px 22px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="https://big5.rd-sim.de/static/rdsim-favicon.png" width="30" height="30" alt="" style="display:block;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;">RD-SIM<span style="color:#e63946;">.DE</span></span>
                  </td>
                </tr>
              </table>
              <div style="color:#f4a01c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-top:8px;">Big Five Test · Persönliche Einladung</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hallo ${safeName},</p>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">Sie wurden zum <strong>Big Five Persönlichkeitstest</strong> eingeladen.</p>

              <div style="text-align:center;margin:28px 0;">
                <a href="${safeLink}" style="background-color:#e63946;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:2px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;font-size:14px;display:inline-block;">Test jetzt starten</a>
              </div>

              <p style="margin:0 0 24px;font-size:13px;color:#777777;word-break:break-all;">Falls der Button nicht funktioniert, öffnen Sie diesen Link:<br /><a href="${safeLink}" style="color:#e63946;">${safeLink}</a></p>

              <hr style="border:none;border-top:1px solid #eeeeee;margin:24px 0;" />

              <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.5px;color:#1a1a1a;margin:0 0 8px;">Über den Test</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.6;">Der Big-Five-Persönlichkeitstest misst fünf zentrale Persönlichkeitsdimensionen: Neurotizismus, Extraversion, Offenheit für Erfahrungen, Verträglichkeit und Gewissenhaftigkeit. Er basiert auf dem wissenschaftlich etablierten Fünf-Faktoren-Modell.</p>

              <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.5px;color:#1a1a1a;margin:0 0 8px;">Warum das für Führungskräfte im Rettungsdienst wichtig ist</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.6;">In Einsatzlagen mit hohem Zeit- und Handlungsdruck hängt der Erfolg der Einsatzleitung nicht nur von Fachwissen ab, sondern auch von der eigenen Persönlichkeit. Wer die eigenen Reaktionsmuster auf Stress kennt, kann Entscheidungen bewusster treffen, im Team klarer kommunizieren und auch unter Druck handlungsfähig bleiben.</p>

              <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.5px;color:#1a1a1a;margin:0 0 8px;">Ablauf &amp; Regeln</h2>
              <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#555555;line-height:1.8;">
                <li>Antworten Sie ehrlich – auch wenn Ihnen eine Antwort nicht gefällt.</li>
                <li>Beschreiben Sie sich so, wie Sie aktuell tatsächlich sind – nicht, wie Sie gerne wären.</li>
                <li>Die erste, spontane Reaktion ist meist die zutreffendste.</li>
                <li>Planen Sie ca. 15–20 Minuten ein und beantworten Sie den Test möglichst am Stück.</li>
              </ul>

              <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.5px;color:#1a1a1a;margin:0 0 8px;">Nach dem Test</h2>
              <div style="background-color:#f4f7fb;border-left:4px solid #0a0e1a;padding:14px 18px;margin:0 0 20px;font-size:14px;color:#333333;line-height:1.6;">
                Die Ergebnisse werden im Rahmen des Kurses ausführlich besprochen. Drucken Sie sich Ihren PDF-Report nach Abschluss des Tests daher am besten aus und bringen Sie ihn zum Kurs mit.
              </div>

              <div style="background-color:#fff8ec;border-left:4px solid #f4a01c;padding:14px 18px;font-size:13px;color:#333333;line-height:1.6;">
                <strong style="color:#c97a00;">Datenschutz:</strong> Der Test läuft vollständig in Ihrem Browser. Es gibt keine Serverspeicherung und keine Übermittlung an Dritte – niemand außer Ihnen sieht Ihre Antworten oder Ihr Ergebnis.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f4f6;padding:16px 32px;text-align:center;font-size:12px;color:#999999;">
              rd-sim.de
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendEmail ({ name, email, link, ccEmail }) {
  await transporter.sendMail({
    from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`,
    to: `"${name}" <${email}>`,
    cc: ccEmail || undefined,
    subject: 'Ihre persönliche Einladung zum Big Five Test',
    text: buildEmailText(name, link),
    html: buildEmailHtml(name, link)
  })
}

function buildReportEmailText (name) {
  return [
    `Hallo ${name},`,
    '',
    'im Anhang finden Sie Ihren persönlichen Big Five Ergebnisbericht als PDF.',
    '',
    'Die Ergebnisse werden im Rahmen des Kurses ausführlich besprochen. Drucken Sie sich den Bericht daher am besten aus und bringen Sie ihn zum Kurs mit.',
    '',
    'Datenschutz: Dieser Bericht wurde ausschließlich zum Zweck des Versands kurz auf unserem Mailserver verarbeitet - es gibt keine dauerhafte Speicherung Ihrer Antworten oder Ihres Ergebnisses.',
    '',
    'Viele Grüße',
    'rd-sim.de'
  ].join('\n')
}

function buildReportEmailHtml (name) {
  const safeName = escapeHtml(name)
  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background-color:#f4f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;max-width:600px;width:100%;">
          <tr>
            <td style="padding:0;line-height:0;">
              <img src="https://big5.rd-sim.de/static/hero.jpg" width="600" height="150" alt="" style="display:block;width:100%;height:150px;object-fit:cover;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#0a0e1a;padding:20px 32px 22px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="https://big5.rd-sim.de/static/rdsim-favicon.png" width="30" height="30" alt="" style="display:block;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;">RD-SIM<span style="color:#e63946;">.DE</span></span>
                  </td>
                </tr>
              </table>
              <div style="color:#f4a01c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-top:8px;">Big Five Test · Ihr Ergebnisbericht</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hallo ${safeName},</p>
              <p style="margin:0 0 20px;font-size:15px;color:#333333;line-height:1.6;">im Anhang finden Sie Ihren persönlichen <strong>Big Five Ergebnisbericht</strong> als PDF.</p>

              <div style="background-color:#f4f7fb;border-left:4px solid #0a0e1a;padding:14px 18px;margin:0 0 20px;font-size:14px;color:#333333;line-height:1.6;">
                Die Ergebnisse werden im Rahmen des Kurses ausführlich besprochen. Drucken Sie sich den Bericht daher am besten aus und bringen Sie ihn zum Kurs mit.
              </div>

              <div style="background-color:#fff8ec;border-left:4px solid #f4a01c;padding:14px 18px;font-size:13px;color:#333333;line-height:1.6;">
                <strong style="color:#c97a00;">Datenschutz:</strong> Dieser Bericht wurde ausschließlich zum Zweck des Versands kurz auf unserem Mailserver verarbeitet – es gibt keine dauerhafte Speicherung Ihrer Antworten oder Ihres Ergebnisses.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f4f6;padding:16px 32px;text-align:center;font-size:12px;color:#999999;">
              rd-sim.de
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendReportEmail ({ name, email, pdfBase64 }) {
  const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',').pop() : pdfBase64
  await transporter.sendMail({
    from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`,
    to: `"${name}" <${email}>`,
    subject: 'Ihr Big Five Ergebnisbericht',
    text: buildReportEmailText(name),
    html: buildReportEmailHtml(name),
    attachments: [{
      filename: 'big-five-ergebnisbericht.pdf',
      content: base64Data,
      encoding: 'base64',
      contentType: 'application/pdf'
    }]
  })
}

app.post('/send-report', async (req, res) => {
  if (!isConfigured()) {
    res.status(500).json({ error: 'Mail service is not configured on the server' })
    return
  }

  const { name, email, pdfBase64 } = req.body || {}
  if (!name || !isValidEmail(email) || !pdfBase64) {
    res.status(400).json({ error: 'name, email and pdfBase64 are required' })
    return
  }

  try {
    await sendReportEmail({ name, email: email.trim(), pdfBase64 })
    res.json({ status: 'sent' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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
