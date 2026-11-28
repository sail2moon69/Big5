// PDFs for the Lehrgangsverwaltung, all built in the trainer's browser:
// invitation handouts with QR codes and result reports from the stored answers.
import generateInvitePdf from './invite-pdf'
import { generatePdfReportBlob } from './pdf-report'
import { buildResume } from './build-resume'
import { inviteLink } from './course-api'

function slug (value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'lehrgang'
}

function saveBlob (blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => window.URL.revokeObjectURL(url), 10000)
}

export async function downloadHandouts (course, participants) {
  const QRCode = (await import('qrcode')).default
  const invites = []
  for (const participant of participants) {
    const link = inviteLink(participant.token)
    const qrDataUrl = await QRCode.toDataURL(link, { margin: 1, width: 320, color: { dark: '#0a0e1a', light: '#ffffff' } })
    invites.push({ name: participant.name, link, qrDataUrl })
  }
  await generateInvitePdf(invites, course.brand, 'stored', {
    courseName: course.name,
    filename: `einladungen-${slug(course.name)}.pdf`
  })
}

async function reportBlob (entry, brand) {
  const { resume, language } = buildResume(entry.result.answers, entry.result.language)
  const { blob } = await generatePdfReportBlob({ resume, viewLanguage: language, participantName: entry.name, brand })
  return blob
}

export async function downloadResult (course, entry) {
  saveBlob(await reportBlob(entry, course.brand), `big-five-${slug(entry.name)}.pdf`)
}

// one PDF per person in a ZIP; onProgress(done, total) for the button label
export async function downloadResultsZip (course, entries, onProgress) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const used = new Set()
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    let name = `big-five-${slug(entry.name)}`
    // two people with the same name must not overwrite each other in the archive
    if (used.has(name)) name = `${name}-${entry.participantId}`
    used.add(name)
    zip.file(`${name}.pdf`, await reportBlob(entry, course.brand))
    if (onProgress) onProgress(index + 1, entries.length)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, `ergebnisse-${slug(course.name)}.zip`)
}
