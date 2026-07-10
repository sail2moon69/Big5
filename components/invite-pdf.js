import { loadCoverImage } from './pdf-report'

const RED = '#e63946'
const ORANGE = '#f4a01c'
const NAVY = '#0a0e1a'
const MUTED = '#7a8499'
const TEXT = '#1a1a1a'
const BORDER = '#dcdce2'
const LOGO_URL = '/static/rdsim-favicon.png'
const HERO_URL = '/static/hero.jpg'

const MARGIN = 50
const BANNER_HEIGHT = 165

function hexToRgb (hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.substring(0, 2), 16),
    parseInt(value.substring(2, 4), 16),
    parseInt(value.substring(4, 6), 16)
  ]
}

async function loadImageAsDataUrl (url) {
  const response = await window.fetch(url)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new window.FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function drawBanner (pdf, pageWidth, heroDataUrl, logoDataUrl) {
  if (heroDataUrl) {
    pdf.addImage(heroDataUrl, 'JPEG', 0, 0, pageWidth, BANNER_HEIGHT)
  } else {
    pdf.setFillColor(...hexToRgb(NAVY))
    pdf.rect(0, 0, pageWidth, BANNER_HEIGHT, 'F')
  }

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', MARGIN, 18, 18, 18)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  pdf.text('RD-SIM.DE', MARGIN + (logoDataUrl ? 24 : 0), 30)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(255, 255, 255)
  pdf.text('BIG FIVE TEST', pageWidth / 2, 95, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  pdf.setTextColor(...hexToRgb(ORANGE))
  pdf.text('PERSÖNLICHE EINLADUNG', pageWidth / 2, 113, { align: 'center' })

  pdf.setDrawColor(...hexToRgb(RED))
  pdf.setLineWidth(2)
  pdf.line(pageWidth / 2 - 24, 125, pageWidth / 2 + 24, 125)
}

function drawSectionHeading (pdf, text, x, y, width) {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10.5)
  pdf.setTextColor(...hexToRgb(TEXT))
  const lines = pdf.splitTextToSize(text.toUpperCase(), width)
  pdf.text(lines, x, y)
  return y + lines.length * 13
}

function drawParagraph (pdf, text, x, y, width, options = {}) {
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
  pdf.setFontSize(options.fontSize || 9)
  pdf.setTextColor(...hexToRgb(options.color || TEXT))
  const lines = pdf.splitTextToSize(text, width)
  pdf.text(lines, x, y)
  return y + lines.length * (options.lineHeight || 11.5)
}

export default async function generateInvitePdf (invites) {
  const { jsPDF } = await import('jspdf')
  // eslint-disable-next-line new-cap
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  let logoDataUrl = null
  try {
    logoDataUrl = await loadImageAsDataUrl(LOGO_URL)
  } catch (error) {
    logoDataUrl = null
  }

  let heroDataUrl = null
  try {
    heroDataUrl = await loadCoverImage(HERO_URL, Math.round(pageWidth * 2), Math.round(BANNER_HEIGHT * 2))
  } catch (error) {
    heroDataUrl = null
  }

  invites.forEach((invite, index) => {
    if (index > 0) {
      pdf.addPage()
    }

    drawBanner(pdf, pageWidth, heroDataUrl, logoDataUrl)

    let y = BANNER_HEIGHT + 28
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(invite.name, pageWidth / 2, y, { align: 'center' })
    y += 20

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...hexToRgb(MUTED))
    const instructions = pdf.splitTextToSize(
      'Scannen Sie den QR-Code mit Ihrem Smartphone oder öffnen Sie den Link, um Ihren persönlichen Big-Five-Test zu starten.',
      contentWidth - 60
    )
    pdf.text(instructions, pageWidth / 2, y, { align: 'center' })
    y += instructions.length * 12 + 14

    const qrSize = 130
    pdf.addImage(invite.qrDataUrl, 'PNG', pageWidth / 2 - qrSize / 2, y, qrSize, qrSize)
    y += qrSize + 14

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...hexToRgb(MUTED))
    const linkLines = pdf.splitTextToSize(invite.link, contentWidth - 100)
    pdf.text(linkLines, pageWidth / 2, y, { align: 'center' })
    y += linkLines.length * 10 + 14

    pdf.setDrawColor(...hexToRgb(BORDER))
    pdf.setLineWidth(0.5)
    pdf.line(MARGIN, y, pageWidth - MARGIN, y)
    y += 18

    y = drawSectionHeading(pdf, 'Über den Test', MARGIN, y, contentWidth)
    y = drawParagraph(
      pdf,
      'Der Big-Five-Persönlichkeitstest misst fünf zentrale Persönlichkeitsdimensionen: Neurotizismus, Extraversion, Offenheit für Erfahrungen, Verträglichkeit und Gewissenhaftigkeit.',
      MARGIN, y, contentWidth
    ) + 10

    y = drawSectionHeading(pdf, 'Warum das für Führungskräfte im Rettungsdienst wichtig ist', MARGIN, y, contentWidth)
    y = drawParagraph(
      pdf,
      'In Einsatzlagen mit hohem Zeit- und Handlungsdruck hängt der Erfolg der Einsatzleitung nicht nur von Fachwissen ab, sondern auch von der eigenen Persönlichkeit. Wer die eigenen Reaktionsmuster auf Stress kennt, kann Entscheidungen bewusster treffen und auch unter Druck handlungsfähig bleiben.',
      MARGIN, y, contentWidth
    ) + 10

    y = drawSectionHeading(pdf, 'Ablauf & Regeln', MARGIN, y, contentWidth)
    const rules = [
      'Antworten Sie ehrlich, auch wenn Ihnen eine Antwort nicht gefällt.',
      'Beschreiben Sie sich so, wie Sie aktuell tatsächlich sind, nicht wie Sie gerne wären.',
      'Die erste, spontane Reaktion ist meist die zutreffendste.',
      'Planen Sie ca. 15-20 Minuten ein und beantworten Sie den Test möglichst am Stück.'
    ]
    rules.forEach(rule => {
      y = drawParagraph(pdf, `–  ${rule}`, MARGIN, y, contentWidth - 10, { lineHeight: 11.5 })
    })
    y += 8

    const noteHeight = 42
    pdf.setFillColor(255, 248, 236)
    pdf.rect(MARGIN, y, contentWidth, noteHeight, 'F')
    pdf.setFillColor(...hexToRgb(ORANGE))
    pdf.rect(MARGIN, y, 3, noteHeight, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...hexToRgb(ORANGE))
    pdf.text('Datenschutz:', MARGIN + 12, y + 15)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...hexToRgb(TEXT))
    const privacyLines = pdf.splitTextToSize(
      'Der Test läuft vollständig in Ihrem Browser. Es gibt keine Serverspeicherung und keine Übermittlung an Dritte.',
      contentWidth - 24
    )
    pdf.text(privacyLines, MARGIN + 12, y + 27)

    pdf.setDrawColor(...hexToRgb(RED))
    pdf.setLineWidth(1)
    pdf.line(pageWidth / 2 - 28, pageHeight - 38, pageWidth / 2 + 28, pageHeight - 38)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text('RD-SIM.DE', pageWidth / 2, pageHeight - 22, { align: 'center' })
  })

  pdf.save('big-five-einladungen.pdf')
}
