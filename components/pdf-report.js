const RED = '#e63946'
const ORANGE = '#f4a01c'
const NAVY = '#0a0e1a'
const MUTED = '#7a8499'
const TEXT = '#1a1a1a'
const BORDER = '#dcdce2'
const LOGO_URL = '/static/rdsim-favicon.png'
const HERO_URL = '/static/hero.jpg'

const DOMAIN_COLORS = ['#e63946', '#f4a01c', '#457b9d', '#2a9d8f', '#6c584c']

const PAGE_MARGIN = 48
const HEADER_BOTTOM = 54
const FOOTER_TOP_OFFSET = 36

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

export async function loadCoverImage (url, targetWidth, targetHeight) {
  const image = await new Promise((resolve, reject) => {
    const element = new window.Image()
    element.crossOrigin = 'anonymous'
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = url
  })

  const canvas = window.document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')

  const targetAspect = targetWidth / targetHeight
  const sourceAspect = image.width / image.height
  let sx, sy, sw, sh
  if (sourceAspect > targetAspect) {
    sh = image.height
    sw = sh * targetAspect
    sx = (image.width - sw) / 2
    sy = 0
  } else {
    sw = image.width
    sh = sw / targetAspect
    sx = 0
    sy = (image.height - sh) / 2
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)

  // dark vignette/gradient overlay so the title text stays legible, matching the website hero
  const verticalFade = ctx.createLinearGradient(0, 0, 0, targetHeight)
  verticalFade.addColorStop(0, 'rgba(6, 9, 15, 0.55)')
  verticalFade.addColorStop(0.35, 'rgba(6, 9, 15, 0.4)')
  verticalFade.addColorStop(0.75, 'rgba(6, 9, 15, 0.8)')
  verticalFade.addColorStop(1, 'rgba(6, 9, 15, 0.97)')
  ctx.fillStyle = verticalFade
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  const vignette = ctx.createRadialGradient(
    targetWidth / 2, targetHeight / 2, 0,
    targetWidth / 2, targetHeight / 2, Math.max(targetWidth, targetHeight) * 0.65
  )
  vignette.addColorStop(0, 'rgba(6, 9, 15, 0)')
  vignette.addColorStop(1, 'rgba(6, 9, 15, 0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  return canvas.toDataURL('image/jpeg', 0.85)
}

function drawHeader (pdf, pageWidth, logoDataUrl, participantName) {
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', PAGE_MARGIN, 18, 18, 18)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...hexToRgb(NAVY))
  pdf.text('RD-SIM.DE', PAGE_MARGIN + (logoDataUrl ? 24 : 0), 30)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...hexToRgb(MUTED))
  pdf.text(participantName ? `Big Five Test · ${participantName}` : 'Big Five Persönlichkeitstest', pageWidth - PAGE_MARGIN, 30, { align: 'right' })
  pdf.setDrawColor(...hexToRgb(RED))
  pdf.setLineWidth(1.5)
  pdf.line(PAGE_MARGIN, HEADER_BOTTOM - 8, pageWidth - PAGE_MARGIN, HEADER_BOTTOM - 8)
}

function newPage (pdf, pageWidth, logoDataUrl, participantName) {
  pdf.addPage()
  drawHeader(pdf, pageWidth, logoDataUrl, participantName)
  return HEADER_BOTTOM + 24
}

function ensureSpace (pdf, y, needed, pageWidth, pageHeight, logoDataUrl, participantName) {
  if (y + needed > pageHeight - FOOTER_TOP_OFFSET) {
    return newPage(pdf, pageWidth, logoDataUrl, participantName)
  }
  return y
}

function drawBarChart (pdf, { x, y, width, height, items, maxValue, colors }) {
  const chartBottom = y + height
  const steps = 4
  pdf.setDrawColor(...hexToRgb(BORDER))
  pdf.setLineWidth(0.5)
  for (let i = 0; i <= steps; i++) {
    const value = Math.round((maxValue / steps) * i)
    const lineY = chartBottom - (height * i) / steps
    pdf.line(x, lineY, x + width, lineY)
    pdf.setFontSize(7)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text(String(value), x - 6, lineY + 2, { align: 'right' })
  }
  const gap = 12
  const barWidth = (width - gap * (items.length - 1)) / items.length
  items.forEach((item, index) => {
    const barHeight = Math.max((item.value / maxValue) * height, 1)
    const barX = x + index * (barWidth + gap)
    const barY = chartBottom - barHeight
    pdf.setFillColor(...hexToRgb(colors[index % colors.length]))
    pdf.rect(barX, barY, barWidth, barHeight, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(String(item.value), barX + barWidth / 2, barY - 5, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...hexToRgb(MUTED))
    const labelLines = pdf.splitTextToSize(item.label, barWidth + gap - 2)
    pdf.text(labelLines, barX + barWidth / 2, chartBottom + 11, { align: 'center' })
  })
}

function drawParagraphs (pdf, text, x, y, width, pageWidth, pageHeight, logoDataUrl, participantName, options = {}) {
  const lineHeight = options.lineHeight || 12
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
  pdf.setFontSize(options.fontSize || 9.5)
  pdf.setTextColor(...hexToRgb(options.color || TEXT))
  let cursorY = y
  const paragraphs = text.split(/<br\s*\/?>/gi).map(p => p.trim()).filter(Boolean)
  paragraphs.forEach(paragraph => {
    const lines = pdf.splitTextToSize(paragraph, width)
    cursorY = ensureSpace(pdf, cursorY, lines.length * lineHeight, pageWidth, pageHeight, logoDataUrl, participantName)
    pdf.text(lines, x, cursorY)
    cursorY += lines.length * lineHeight + 6
  })
  return cursorY
}

function drawSectionHeading (pdf, text, x, y, color) {
  pdf.setFillColor(...hexToRgb(color))
  pdf.rect(x, y - 10, 4, 14, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(...hexToRgb(TEXT))
  pdf.text(text.toUpperCase(), x + 10, y)
  return y + 22
}

export default async function generatePdfReport ({ resume, viewLanguage, participantName }) {
  const { jsPDF } = await import('jspdf')
  // eslint-disable-next-line new-cap
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  let logoDataUrl = null
  try {
    logoDataUrl = await loadImageAsDataUrl(LOGO_URL)
  } catch (error) {
    logoDataUrl = null
  }

  const dateStr = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })

  let coverImageDataUrl = null
  try {
    coverImageDataUrl = await loadCoverImage(HERO_URL, Math.round(pageWidth * 2), Math.round(pageHeight * 2))
  } catch (error) {
    coverImageDataUrl = null
  }

  // --- Cover page ---
  if (coverImageDataUrl) {
    pdf.addImage(coverImageDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)
  } else {
    pdf.setFillColor(...hexToRgb(NAVY))
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')
  }
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 32, 150, 64, 64)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(34)
  pdf.setTextColor(255, 255, 255)
  pdf.text('BIG FIVE', pageWidth / 2, 260, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...hexToRgb(ORANGE))
  pdf.text('PERSÖNLICHKEITSTEST · ERGEBNISBERICHT', pageWidth / 2, 286, { align: 'center' })
  pdf.setDrawColor(...hexToRgb(RED))
  pdf.setLineWidth(2)
  pdf.line(pageWidth / 2 - 30, 306, pageWidth / 2 + 30, 306)
  if (participantName) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(255, 255, 255)
    pdf.text(`Ergebnis für ${participantName}`, pageWidth / 2, 332, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
  }
  pdf.setFontSize(10)
  pdf.setTextColor(220, 222, 230)
  pdf.text(`Erstellt am ${dateStr}`, pageWidth / 2, participantName ? 356 : 334, { align: 'center' })
  pdf.setFontSize(9)
  pdf.setTextColor(...hexToRgb(MUTED))
  pdf.text('rd-sim.de', pageWidth / 2, pageHeight - 48, { align: 'center' })

  // --- Overview page ---
  let y = newPage(pdf, pageWidth, logoDataUrl, participantName)
  y = drawSectionHeading(pdf, 'Übersicht', PAGE_MARGIN, y, RED)

  const overviewItems = resume.map((domain, index) => ({ label: domain.title, value: domain.score }))
  const chartHeight = 170
  y = ensureSpace(pdf, y, chartHeight + 40, pageWidth, pageHeight, logoDataUrl, participantName)
  drawBarChart(pdf, {
    x: PAGE_MARGIN + 20,
    y,
    width: contentWidth - 40,
    height: chartHeight,
    items: overviewItems,
    maxValue: 120,
    colors: DOMAIN_COLORS
  })
  y += chartHeight + 40

  // table of domain scores
  y = ensureSpace(pdf, y, 20, pageWidth, pageHeight, logoDataUrl, participantName)
  const colDomain = PAGE_MARGIN
  const colScore = PAGE_MARGIN + contentWidth * 0.55
  const colLevel = PAGE_MARGIN + contentWidth * 0.75
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...hexToRgb(MUTED))
  pdf.text('DOMÄNE', colDomain, y)
  pdf.text('SCORE', colScore, y)
  pdf.text('AUSPRÄGUNG', colLevel, y)
  y += 8
  pdf.setDrawColor(...hexToRgb(BORDER))
  pdf.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y)
  y += 14
  resume.forEach((domain, index) => {
    y = ensureSpace(pdf, y, 20, pageWidth, pageHeight, logoDataUrl, participantName)
    pdf.setFillColor(...hexToRgb(DOMAIN_COLORS[index % DOMAIN_COLORS.length]))
    pdf.rect(colDomain, y - 9, 8, 8, 'F')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(domain.title, colDomain + 14, y)
    pdf.text(`${domain.score} / 120`, colScore, y)
    pdf.text(domain.scoreText, colLevel, y)
    y += 18
  })

  // --- Domain detail pages ---
  resume.forEach((domain, index) => {
    const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length]
    y = newPage(pdf, pageWidth, logoDataUrl, participantName)
    y = drawSectionHeading(pdf, domain.title, PAGE_MARGIN, y, color)

    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...hexToRgb(MUTED))
    const shortDescLines = pdf.splitTextToSize(domain.shortDescription, contentWidth)
    pdf.text(shortDescLines, PAGE_MARGIN, y)
    y += shortDescLines.length * 12 + 10

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(`Score: ${domain.score} / 120 – ${domain.scoreText}`, PAGE_MARGIN, y)
    y += 18

    y = drawParagraphs(pdf, domain.text, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, { bold: true })
    y = drawParagraphs(pdf, domain.description, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName)

    if (domain.facets && domain.facets.length) {
      y += 6
      y = ensureSpace(pdf, y, 40, pageWidth, pageHeight, logoDataUrl, participantName)
      y = drawSectionHeading(pdf, `Facetten – ${domain.title}`, PAGE_MARGIN, y, color)

      const facetChartHeight = 130
      y = ensureSpace(pdf, y, facetChartHeight + 36, pageWidth, pageHeight, logoDataUrl, participantName)
      drawBarChart(pdf, {
        x: PAGE_MARGIN + 20,
        y,
        width: contentWidth - 40,
        height: facetChartHeight,
        items: domain.facets.map(facet => ({ label: facet.title, value: facet.score })),
        maxValue: 20,
        colors: [color]
      })
      y += facetChartHeight + 36

      domain.facets.forEach(facet => {
        y = ensureSpace(pdf, y, 30, pageWidth, pageHeight, logoDataUrl, participantName)
        pdf.setFillColor(...hexToRgb(color))
        pdf.rect(PAGE_MARGIN, y - 9, Math.max((facet.score / 20) * 60, 2), 6, 'F')
        pdf.setDrawColor(...hexToRgb(BORDER))
        pdf.rect(PAGE_MARGIN, y - 9, 60, 6)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9.5)
        pdf.setTextColor(...hexToRgb(TEXT))
        pdf.text(`${facet.title} (${facet.score}/20 – ${facet.scoreText})`, PAGE_MARGIN + 70, y - 2)
        y += 12
        y = drawParagraphs(pdf, facet.text, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, { fontSize: 8.8, color: MUTED, lineHeight: 11 })
        y += 4
      })
    }
  })

  // --- Footer pass (skip cover page) ---
  const totalPages = pdf.internal.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(...hexToRgb(BORDER))
    pdf.setLineWidth(0.5)
    pdf.line(PAGE_MARGIN, pageHeight - FOOTER_TOP_OFFSET, pageWidth - PAGE_MARGIN, pageHeight - FOOTER_TOP_OFFSET)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text('rd-sim.de · Big Five Test', PAGE_MARGIN, pageHeight - 20)
    pdf.text(`Seite ${i - 1} von ${totalPages - 1}`, pageWidth - PAGE_MARGIN, pageHeight - 20, { align: 'right' })
  }

  const fileSlug = participantName
    ? participantName.trim().toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-+|-+$/g, '')
    : ''
  pdf.save(fileSlug ? `big-five-ergebnis-${fileSlug}.pdf` : 'big-five-ergebnis.pdf')
}
