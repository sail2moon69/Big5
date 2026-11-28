import { loadCoverImage } from './pdf-report'
import { getBrand, loadBrandLogo } from './report-brands'

const MUTED = '#7a8499'
const TEXT = '#1a1a1a'
const BORDER = '#dcdce2'

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

// jsPDF leaves the letter spacing out when it right-aligns, so the line would stick out past
// the margin; place it from the measured width instead
function drawSpacedTextRight (pdf, text, rightX, y, charSpace) {
  // jsPDF also adds the spacing after the last letter
  const width = pdf.getTextWidth(text) + charSpace * text.length
  pdf.setCharSpace(charSpace)
  pdf.text(text, rightX - width, y)
  pdf.setCharSpace(0)
}

// White header: logo on the left, title on the right, one thin accent rule underneath
function drawLightBanner (pdf, pageWidth, logo, brand) {
  if (logo) {
    const height = brand.logoIsWordmark ? 62 : 26
    const width = Math.min(height * logo.ratio, 220)
    pdf.addImage(logo.dataUrl, logo.format, MARGIN, 40, width, width / logo.ratio)
  } else {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(...hexToRgb(brand.dark))
    pdf.text(brand.wordmark, MARGIN, 70)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(...hexToRgb(TEXT))
  pdf.text('Big Five Test', pageWidth - MARGIN, 72, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...hexToRgb(brand.eyebrow))
  drawSpacedTextRight(pdf, 'PERSÖNLICHE EINLADUNG', pageWidth - MARGIN, 88, 1.2)

  pdf.setDrawColor(...hexToRgb(BORDER))
  pdf.setLineWidth(0.6)
  pdf.line(MARGIN, 122, pageWidth - MARGIN, 122)
  pdf.setDrawColor(...hexToRgb(brand.accent))
  pdf.setLineWidth(2.2)
  pdf.line(MARGIN, 122, MARGIN + 56, 122)
}

function drawBanner (pdf, pageWidth, heroDataUrl, logo, brand) {
  if (brand.style === 'light') {
    drawLightBanner(pdf, pageWidth, logo, brand)
    return
  }
  if (heroDataUrl) {
    pdf.addImage(heroDataUrl, 'JPEG', 0, 0, pageWidth, BANNER_HEIGHT)
  } else {
    pdf.setFillColor(...hexToRgb(brand.dark))
    pdf.rect(0, 0, pageWidth, BANNER_HEIGHT, 'F')
  }

  if (logo && brand.logoIsWordmark) {
    // coloured logo with lettering: on a light card so it stays readable on the dark banner
    const height = 40
    const width = height * logo.ratio
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(MARGIN - 6, 14, width + 12, height + 12, 4, 4, 'F')
    pdf.addImage(logo.dataUrl, logo.format, MARGIN, 20, width, height)
  } else {
    if (logo) {
      pdf.addImage(logo.dataUrl, logo.format, MARGIN, 18, 18, 18)
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(255, 255, 255)
    pdf.text(brand.wordmark, MARGIN + (logo ? 24 : 0), 30)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(255, 255, 255)
  pdf.text('BIG FIVE TEST', pageWidth / 2, 95, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  pdf.setTextColor(...hexToRgb(brand.coverEyebrow))
  pdf.text('PERSÖNLICHE EINLADUNG', pageWidth / 2, 113, { align: 'center' })

  pdf.setDrawColor(...hexToRgb(brand.coverAccent))
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

const PRIVACY_TEXTS = {
  open: 'Der Test läuft vollständig in Ihrem Browser. Es gibt keine Serverspeicherung und keine Übermittlung an Dritte.',
  sealed: 'Der Test läuft in Ihrem Browser, Ihre Antworten werden nicht auf einem Server gespeichert. Im Lehrgangsmodus wird Ihr Ergebnisbericht nach dem Absenden einmalig per E-Mail an Ihre Lehrgangsleitung übermittelt. Darüber hinaus erhält niemand Ihre Daten.',
  stored: 'Ihre Antworten werden nach dem Absenden verschlüsselt auf dem Server von rd-sim.de gespeichert. Zugriff hat nur Ihre Lehrgangsleitung, die Daten werden nach Ende des Lehrgangs automatisch gelöscht. Vor Testbeginn erhalten Sie alle Hinweise und entscheiden selbst über Ihre Einwilligung.'
}

// privacy: 'open' | 'sealed' | 'stored'; true/false still work for the older two modes
export default async function generateInvitePdf (invites, brandId, privacy, options = {}) {
  const privacyMode = privacy === true ? 'sealed' : (PRIVACY_TEXTS[privacy] ? privacy : 'open')
  const { jsPDF } = await import('jspdf')
  // eslint-disable-next-line new-cap
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  const brand = getBrand(brandId)
  const logo = await loadBrandLogo(brand)
  const isLight = brand.style === 'light'

  let heroDataUrl = null
  try {
    heroDataUrl = !isLight && brand.coverImageUrl
      ? await loadCoverImage(brand.coverImageUrl, Math.round(pageWidth * 2), Math.round(BANNER_HEIGHT * 2))
      : null
  } catch (error) {
    heroDataUrl = null
  }

  invites.forEach((invite, index) => {
    if (index > 0) {
      pdf.addPage()
    }

    drawBanner(pdf, pageWidth, heroDataUrl, logo, brand)

    let y = BANNER_HEIGHT + 28
    if (options.courseName) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...hexToRgb(MUTED))
      pdf.text(pdf.splitTextToSize(`Lehrgang: ${options.courseName}`, contentWidth)[0], pageWidth / 2, y - 6, { align: 'center' })
      y += 14
    }
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
    if (isLight) {
      // a thin frame instead of a coloured area keeps the page calm
      pdf.setDrawColor(...hexToRgb(BORDER))
      pdf.setLineWidth(0.8)
      pdf.roundedRect(pageWidth / 2 - qrSize / 2 - 10, y - 10, qrSize + 20, qrSize + 20, 8, 8, 'S')
    }
    pdf.addImage(invite.qrDataUrl, 'PNG', pageWidth / 2 - qrSize / 2, y, qrSize, qrSize)
    y += qrSize + (isLight ? 22 : 14)

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

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    const privacyLines = pdf.splitTextToSize(PRIVACY_TEXTS[privacyMode], contentWidth - 24)
    // the Lehrgangsmodus note is longer, so the box grows with the text
    const noteHeight = 22 + privacyLines.length * 10.5
    pdf.setFillColor(...hexToRgb(brand.noteBackground))
    pdf.rect(MARGIN, y, contentWidth, noteHeight, 'F')
    pdf.setFillColor(...hexToRgb(brand.eyebrow))
    pdf.rect(MARGIN, y, 3, noteHeight, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...hexToRgb(brand.eyebrow))
    pdf.text('Datenschutz:', MARGIN + 12, y + 15)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(privacyLines, MARGIN + 12, y + 27)

    pdf.setDrawColor(...hexToRgb(brand.accent))
    pdf.setLineWidth(1)
    pdf.line(pageWidth / 2 - 28, pageHeight - 38, pageWidth / 2 + 28, pageHeight - 38)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text(brand.wordmark, pageWidth / 2, pageHeight - 22, { align: 'center' })
  })

  pdf.save(options.filename || 'big-five-einladungen.pdf')
}
