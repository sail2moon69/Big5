const RED = '#e63946'
const ORANGE = '#f4a01c'
const NAVY = '#0a0e1a'
const MUTED = '#7a8499'
const TEXT = '#1a1a1a'
const BORDER = '#dcdce2'
const WHITE = '#ffffff'
const LOGO_URL = '/static/rdsim-favicon.png'
const HERO_URL = '/static/hero.jpg'

const DOMAIN_COLORS = ['#e63946', '#f4a01c', '#457b9d', '#2a9d8f', '#6c584c']

const PAGE_MARGIN = 48
const HEADER_BOTTOM = 54
const FOOTER_TOP_OFFSET = 30
const STRIP_WIDTH = 10

function hexToRgb (hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.substring(0, 2), 16),
    parseInt(value.substring(2, 4), 16),
    parseInt(value.substring(4, 6), 16)
  ]
}

function isLightColor (hex) {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150
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

function drawHeader (pdf, pageWidth, logoDataUrl, participantName, pageNumber) {
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', PAGE_MARGIN, 16, 16, 16)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10.5)
  pdf.setTextColor(...hexToRgb(NAVY))
  pdf.text('RD-SIM.DE', PAGE_MARGIN + (logoDataUrl ? 22 : 0), 27)
  if (participantName) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text(participantName, PAGE_MARGIN + (logoDataUrl ? 22 : 0), 37)
  }
  if (pageNumber) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.setTextColor(...hexToRgb(NAVY))
    pdf.text(String(pageNumber).padStart(2, '0'), pageWidth - PAGE_MARGIN, 32, { align: 'right' })
  }
  pdf.setDrawColor(...hexToRgb(RED))
  pdf.setLineWidth(1.5)
  pdf.line(PAGE_MARGIN, HEADER_BOTTOM - 8, pageWidth - PAGE_MARGIN, HEADER_BOTTOM - 8)
}

function newPage (pdf, pageWidth, logoDataUrl, participantName) {
  pdf.addPage()
  const pageNumber = pdf.internal.getNumberOfPages() - 1
  drawHeader(pdf, pageWidth, logoDataUrl, participantName, pageNumber)
  return HEADER_BOTTOM + 24
}

function ensureSpace (pdf, y, needed, pageWidth, pageHeight, logoDataUrl, participantName) {
  if (y + needed > pageHeight - FOOTER_TOP_OFFSET) {
    return newPage(pdf, pageWidth, logoDataUrl, participantName)
  }
  return y
}

function drawSplitHeadline (pdf, regularText, boldText, x, y, fontSize, color) {
  pdf.setTextColor(...hexToRgb(color))
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(fontSize)
  const regularWithSpace = regularText ? `${regularText} ` : ''
  if (regularWithSpace) {
    pdf.text(regularWithSpace, x, y)
  }
  const regularWidth = regularWithSpace ? pdf.getTextWidth(regularWithSpace) : 0
  pdf.setFont('helvetica', 'bold')
  pdf.text(boldText, x + regularWidth, y)
}

function drawLabelBar (pdf, text, x, y, width, color) {
  const height = 22
  const textColor = isLightColor(color) ? TEXT : WHITE
  pdf.setFillColor(...hexToRgb(color))
  pdf.rect(x, y, width, height, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10.5)
  pdf.setTextColor(...hexToRgb(textColor))
  pdf.text(text.toUpperCase(), x + 12, y + height / 2 + 3.5)
  return y + height
}

function drawDomainBand (pdf, pageWidth, y0, contentWidth, color, eyebrow, title, subtitle) {
  const textColor = isLightColor(color) ? TEXT : WHITE
  const x = PAGE_MARGIN

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  const titleLines = pdf.splitTextToSize(title.toUpperCase(), contentWidth)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  const subtitleLines = subtitle ? pdf.splitTextToSize(subtitle, contentWidth) : []

  const eyebrowY = y0 + 30
  const titleY = eyebrowY + 22
  const subtitleStartY = titleY + (titleLines.length - 1) * 21 + 20
  const bandHeight = (subtitleStartY - y0) + Math.max(subtitleLines.length - 1, 0) * 12 + 22

  pdf.setFillColor(...hexToRgb(color))
  pdf.rect(0, y0, pageWidth, bandHeight, 'F')

  pdf.setTextColor(...hexToRgb(textColor))
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.text(eyebrow.toUpperCase(), x, eyebrowY)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(titleLines, x, titleY)

  if (subtitleLines.length) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.text(subtitleLines, x, subtitleStartY)
  }

  return y0 + bandHeight + 26
}

function drawDotLeader (pdf, x1, x2, y) {
  pdf.setFillColor(...hexToRgb(BORDER))
  for (let dx = x1; dx < x2; dx += 4) {
    pdf.circle(dx, y - 2, 0.4, 'F')
  }
}

function drawTableOfContents (pdf, { contentWidth, sections }) {
  let y = HEADER_BOTTOM + 44

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...hexToRgb(ORANGE))
  pdf.text('IHR ERGEBNISBERICHT IM ÜBERBLICK', PAGE_MARGIN, y)
  y += 26

  drawSplitHeadline(pdf, 'INHALT', 'UND STRUKTUR', PAGE_MARGIN, y, 26, TEXT)
  y += 46

  sections.forEach(section => {
    const swatchSize = 10
    pdf.setFillColor(...hexToRgb(section.color))
    pdf.rect(PAGE_MARGIN, y - 9, swatchSize, swatchSize, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(...hexToRgb(TEXT))
    const titleUpper = section.title.toUpperCase()
    pdf.text(titleUpper, PAGE_MARGIN + swatchSize + 10, y)

    const pageLabel = section.displayStart === section.displayEnd
      ? String(section.displayStart)
      : `${section.displayStart}–${section.displayEnd}`
    const labelWidth = pdf.getTextWidth(pageLabel)
    const titleWidth = pdf.getTextWidth(titleUpper)
    const leaderStart = PAGE_MARGIN + swatchSize + 10 + titleWidth + 8
    const leaderEnd = PAGE_MARGIN + contentWidth - labelWidth - 8
    if (leaderEnd > leaderStart) {
      drawDotLeader(pdf, leaderStart, leaderEnd, y)
    }
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text(pageLabel, PAGE_MARGIN + contentWidth, y, { align: 'right' })

    y += 16
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text(section.bullets.join('   ·   '), PAGE_MARGIN + swatchSize + 10, y)
    y += 28
  })
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
    // ensureSpace() may have paged and redrawn the header, which mutates the font state - restore ours before drawing
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
    pdf.setFontSize(options.fontSize || 9.5)
    pdf.setTextColor(...hexToRgb(options.color || TEXT))
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

function drawNoteBox (pdf, label, text, x, y, width, pageWidth, pageHeight, logoDataUrl, participantName, color) {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.8)
  const noteLines = pdf.splitTextToSize(text, width - 24)
  const noteHeight = 26 + noteLines.length * 11.5
  const drawnY = ensureSpace(pdf, y, noteHeight + 10, pageWidth, pageHeight, logoDataUrl, participantName)
  pdf.setFillColor(255, 248, 236)
  pdf.rect(x, drawnY, width, noteHeight, 'F')
  pdf.setFillColor(...hexToRgb(color))
  pdf.rect(x, drawnY, 3, noteHeight, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...hexToRgb(color))
  pdf.text(label.toUpperCase(), x + 12, drawnY + 15)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.8)
  pdf.setTextColor(...hexToRgb(TEXT))
  pdf.text(noteLines, x + 12, drawnY + 29)
  return drawnY + noteHeight + 14
}

function drawBulletList (pdf, items, x, y, width, pageWidth, pageHeight, logoDataUrl, participantName, options = {}) {
  let cursorY = y
  items.forEach(item => {
    cursorY = drawParagraphs(pdf, `–  ${item}`, x, cursorY, width, pageWidth, pageHeight, logoDataUrl, participantName, options)
  })
  return cursorY
}

function measureBulletListHeight (pdf, items, width, options = {}) {
  const lineHeight = options.lineHeight || 12
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
  pdf.setFontSize(options.fontSize || 9.5)
  return items.reduce((height, item) => {
    const lines = pdf.splitTextToSize(`–  ${item}`, width)
    return height + lines.length * lineHeight + 6
  }, 0)
}

async function buildPdfDocument ({ resume, viewLanguage, participantName }) {
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
    pdf.addImage(logoDataUrl, 'PNG', pageWidth - PAGE_MARGIN - 22, 34, 22, 22)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  pdf.text('RD-SIM.DE', pageWidth - PAGE_MARGIN - (logoDataUrl ? 30 : 0), 50, { align: 'right' })

  const coverTitleY = pageHeight - 230
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...hexToRgb(ORANGE))
  pdf.text('BIG FIVE TEST · PERSÖNLICHKEITSANALYSE', PAGE_MARGIN, coverTitleY)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(30)
  pdf.setTextColor(255, 255, 255)
  pdf.text('IHR PERSÖNLICHER', PAGE_MARGIN, coverTitleY + 42)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ERGEBNISBERICHT', PAGE_MARGIN, coverTitleY + 78)

  pdf.setDrawColor(...hexToRgb(RED))
  pdf.setLineWidth(2)
  pdf.line(PAGE_MARGIN, coverTitleY + 96, PAGE_MARGIN + 60, coverTitleY + 96)

  let coverInfoY = coverTitleY + 128
  if (participantName) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(255, 255, 255)
    pdf.text(participantName, PAGE_MARGIN, coverInfoY)
    coverInfoY += 20
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(210, 213, 222)
  pdf.text(`Erstellt am ${dateStr}`, PAGE_MARGIN, coverInfoY)

  // --- Reserve a table-of-contents page; filled in once we know how the report paginates ---
  pdf.addPage()
  const tocPage = pdf.internal.getNumberOfPages()
  drawHeader(pdf, pageWidth, logoDataUrl, participantName, tocPage - 1)

  // --- Management summary page: the two most pronounced domains, condensed ---
  newPage(pdf, pageWidth, logoDataUrl, participantName)
  const summaryStartPage = pdf.internal.getNumberOfPages()
  const sections = [{
    title: 'Kurzfassung',
    color: NAVY,
    startPage: summaryStartPage,
    bullets: ['Ihre stärksten Ausprägungen', 'Kurzeinschätzung für die Führungsrolle']
  }]

  let summaryY = HEADER_BOTTOM + 24
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...hexToRgb(ORANGE))
  pdf.text('BIG FIVE TEST · IHRE ERGEBNISSE IN KÜRZE', PAGE_MARGIN, summaryY)
  summaryY += 24
  drawSplitHeadline(pdf, 'IHRE', 'KERNERGEBNISSE', PAGE_MARGIN, summaryY, 24, TEXT)
  summaryY += 28

  summaryY = drawParagraphs(
    pdf,
    'Diese Kurzfassung zeigt Ihre beiden am stärksten ausgeprägten Dimensionen und was das für Ihre Führungsrolle im Rettungsdienst bedeutet. Die vollständige Auswertung aller fünf Dimensionen folgt ab der Übersichtsseite.',
    PAGE_MARGIN, summaryY, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, { color: MUTED, fontSize: 9.5 }
  )
  summaryY += 10

  const domainsWithColor = resume.map((domain, index) => ({ domain, color: DOMAIN_COLORS[index % DOMAIN_COLORS.length] }))
  const topDomains = [...domainsWithColor]
    .sort((a, b) => Math.abs(b.domain.score - 60) - Math.abs(a.domain.score - 60))
    .slice(0, 2)

  topDomains.forEach(({ domain, color }) => {
    summaryY = ensureSpace(pdf, summaryY, 60, pageWidth, pageHeight, logoDataUrl, participantName)
    summaryY = drawLabelBar(pdf, `${domain.title} – ${domain.score}/120 (${domain.scoreText})`, PAGE_MARGIN, summaryY, contentWidth, color)
    summaryY += 14
    summaryY = drawParagraphs(pdf, domain.text, PAGE_MARGIN, summaryY, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, { bold: true })
    if (domain.leadershipNote) {
      summaryY = drawNoteBox(pdf, 'Für Führung im Rettungsdienst', domain.leadershipNote, PAGE_MARGIN, summaryY, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, color)
    }
    summaryY += 16
  })

  // --- Overview page ---
  let y = newPage(pdf, pageWidth, logoDataUrl, participantName)
  const overviewStartPage = pdf.internal.getNumberOfPages()
  sections.push({
    title: 'Übersicht',
    color: RED,
    startPage: overviewStartPage,
    bullets: ['Gesamtprofil aller fünf Dimensionen', 'Zentrale Kennzahlen im Überblick']
  })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...hexToRgb(ORANGE))
  pdf.text('BIG FIVE TEST · DIE ERGEBNISSE AUF EINEN BLICK', PAGE_MARGIN, y)
  y += 24
  drawSplitHeadline(pdf, 'IHR', 'PROFIL', PAGE_MARGIN, y, 24, TEXT)
  y += 28

  y = drawLabelBar(pdf, 'Alle fünf Dimensionen im Vergleich', PAGE_MARGIN, y, contentWidth, RED)
  y += 30

  const overviewItems = resume.map(domain => ({ label: domain.title, value: domain.score }))
  const chartHeight = 160
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
    newPage(pdf, pageWidth, logoDataUrl, participantName)
    const startPage = pdf.internal.getNumberOfPages()
    sections.push({
      title: domain.title,
      color,
      startPage,
      bullets: domain.facets && domain.facets.length ? ['Ausprägung & Score', 'Facetten im Detail'] : ['Ausprägung & Score']
    })

    y = drawDomainBand(pdf, pageWidth, HEADER_BOTTOM, contentWidth, color, `Big Five Test · Trait ${index + 1}/5`, domain.title, domain.shortDescription)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(`Score: ${domain.score} / 120 – ${domain.scoreText}`, PAGE_MARGIN, y)
    y += 18

    y = drawParagraphs(pdf, domain.text, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, { bold: true })
    y = drawParagraphs(pdf, domain.description, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName)

    if (domain.leadershipNote) {
      y = drawNoteBox(pdf, 'Für Führung im Rettungsdienst', domain.leadershipNote, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, ORANGE)
    }

    if (domain.reflectionQuestions && domain.reflectionQuestions.length) {
      y += 4
      const bulletOptions = { fontSize: 9.5, lineHeight: 12 }
      const bulletHeight = measureBulletListHeight(pdf, domain.reflectionQuestions, contentWidth, bulletOptions)
      y = ensureSpace(pdf, y, 30 + bulletHeight, pageWidth, pageHeight, logoDataUrl, participantName)
      y = drawSectionHeading(pdf, 'Reflexionsfragen', PAGE_MARGIN, y, color)
      y = drawBulletList(pdf, domain.reflectionQuestions, PAGE_MARGIN, y, contentWidth, pageWidth, pageHeight, logoDataUrl, participantName, bulletOptions)
      y += 6
    }

    if (domain.facets && domain.facets.length) {
      y += 6
      const facetChartHeight = 130
      y = ensureSpace(pdf, y, 40 + facetChartHeight + 36, pageWidth, pageHeight, logoDataUrl, participantName)
      y = drawSectionHeading(pdf, `Facetten – ${domain.title}`, PAGE_MARGIN, y, color)

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

  const totalPages = pdf.internal.getNumberOfPages()
  sections.forEach((section, index) => {
    section.endPage = index + 1 < sections.length ? sections[index + 1].startPage - 1 : totalPages
    section.displayStart = section.startPage - 1
    section.displayEnd = section.endPage - 1
  })

  // --- Footer pass (skip cover page) ---
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(...hexToRgb(BORDER))
    pdf.setLineWidth(0.5)
    pdf.line(PAGE_MARGIN, pageHeight - FOOTER_TOP_OFFSET, pageWidth - PAGE_MARGIN, pageHeight - FOOTER_TOP_OFFSET)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text('RD-SIM.DE  ·  BIG FIVE TEST', pageWidth / 2, pageHeight - 18, { align: 'center' })
  }

  // --- Accent strip: tags every page of a section with its domain color ---
  sections.forEach(section => {
    for (let p = section.startPage; p <= section.endPage; p++) {
      pdf.setPage(p)
      pdf.setFillColor(...hexToRgb(section.color))
      pdf.rect(pageWidth - STRIP_WIDTH, 0, STRIP_WIDTH, pageHeight, 'F')
    }
  })

  // --- Table of contents content ---
  pdf.setPage(tocPage)
  drawTableOfContents(pdf, { contentWidth, sections })

  const fileSlug = participantName
    ? participantName.trim().toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-+|-+$/g, '')
    : ''
  const filename = fileSlug ? `big-five-ergebnis-${fileSlug}.pdf` : 'big-five-ergebnis.pdf'

  return { pdf, filename }
}

export default async function generatePdfReport (args) {
  const { pdf, filename } = await buildPdfDocument(args)
  pdf.save(filename)
}

export async function generatePdfReportDataUri (args) {
  const { pdf, filename } = await buildPdfDocument(args)
  return { dataUri: pdf.output('datauristring'), filename }
}
