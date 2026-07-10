const RED = '#e63946'
const ORANGE = '#f4a01c'
const NAVY = '#0a0e1a'
const MUTED = '#7a8499'
const TEXT = '#1a1a1a'
const LOGO_URL = '/static/rdsim-favicon.png'

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

export default async function generateInvitePdf (invites) {
  const { jsPDF } = await import('jspdf')
  // eslint-disable-next-line new-cap
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  let logoDataUrl = null
  try {
    logoDataUrl = await loadImageAsDataUrl(LOGO_URL)
  } catch (error) {
    logoDataUrl = null
  }

  invites.forEach((invite, index) => {
    if (index > 0) {
      pdf.addPage()
    }

    pdf.setFillColor(...hexToRgb(NAVY))
    pdf.rect(0, 0, pageWidth, 140, 'F')
    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 20, 30, 40, 40)
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(20)
    pdf.setTextColor(255, 255, 255)
    pdf.text('BIG FIVE TEST', pageWidth / 2, 100, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...hexToRgb(ORANGE))
    pdf.text('PERSÖNLICHE EINLADUNG', pageWidth / 2, 120, { align: 'center' })

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(22)
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(invite.name, pageWidth / 2, 200, { align: 'center' })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(...hexToRgb(MUTED))
    const instructions = pdf.splitTextToSize(
      'Scannen Sie den QR-Code mit Ihrem Smartphone oder öffnen Sie den Link, um Ihren persönlichen Big-Five-Test zu starten.',
      pageWidth - 160
    )
    pdf.text(instructions, pageWidth / 2, 230, { align: 'center' })

    const qrSize = 220
    pdf.addImage(invite.qrDataUrl, 'PNG', pageWidth / 2 - qrSize / 2, 270, qrSize, qrSize)

    pdf.setFontSize(9)
    pdf.setTextColor(...hexToRgb(MUTED))
    const linkLines = pdf.splitTextToSize(invite.link, pageWidth - 160)
    pdf.text(linkLines, pageWidth / 2, 270 + qrSize + 30, { align: 'center' })

    pdf.setDrawColor(...hexToRgb(RED))
    pdf.setLineWidth(1)
    pdf.line(pageWidth / 2 - 40, pageHeight - 60, pageWidth / 2 + 40, pageHeight - 60)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...hexToRgb(MUTED))
    pdf.text('rd-sim.de', pageWidth / 2, pageHeight - 40, { align: 'center' })
  })

  pdf.save('big-five-einladungen.pdf')
}
