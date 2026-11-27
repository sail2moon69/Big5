// Layouts for the generated PDFs (result report and invitation handout).
// The layout is chosen on the invite page and travels inside the invite link and the result link
// as "brand"; anything unknown falls back to rd-sim.de.
//
// Only the frame changes per layout (cover, header, footer, accent colours). The five domain
// colours stay the same in every layout, so charts and sections read identically.

export const DEFAULT_BRAND = 'rdsim'

export const BRANDS = {
  rdsim: {
    id: 'rdsim',
    label: 'rd-sim.de',
    wordmark: 'RD-SIM.DE',
    logoUrl: '/static/rdsim-favicon.png',
    // square icon, drawn next to the wordmark
    logoIsWordmark: false,
    coverImageUrl: '/static/hero.jpg',
    dark: '#0a0e1a',
    accent: '#e63946',
    eyebrow: '#f4a01c',
    coverEyebrow: '#f4a01c',
    coverAccent: '#e63946',
    noteBackground: '#fff8ec'
  },
  sina: {
    id: 'sina',
    label: 'SiNA Krefeld',
    wordmark: 'SINA-KREFELD.ORG',
    // The full SiNA logo (heads + lettering). If the file is missing, the PDFs show the
    // wordmark in the brand green instead. Greens are taken from the logo (#216b4a).
    logoUrl: '/static/sina-logo.png',
    logoIsWordmark: true,
    coverImageUrl: false,
    dark: '#174d35',
    accent: '#216b4a',
    eyebrow: '#2f8a60',
    coverEyebrow: '#a9d8c0',
    coverAccent: '#6fc69a',
    noteBackground: '#ebf5f0'
  }
}

export function getBrand (id) {
  return BRANDS[id] || BRANDS[DEFAULT_BRAND]
}

export const BRAND_OPTIONS = Object.keys(BRANDS).map(id => ({ id, label: BRANDS[id].label }))

// Loads a logo and reports its pixel size, so it can be drawn without distortion.
// Resolves to null when the file is missing or isn't an image.
export async function loadBrandLogo (brand) {
  try {
    const response = await window.fetch(brand.logoUrl)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    if (!/^image\/(png|jpe?g)$/.test(blob.type)) {
      return null
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new window.FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const size = await new Promise((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = reject
      image.src = dataUrl
    })
    return { dataUrl, format: blob.type === 'image/png' ? 'PNG' : 'JPEG', ratio: size.width / size.height }
  } catch (error) {
    return null
  }
}
