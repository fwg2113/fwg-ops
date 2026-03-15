/**
 * Image analysis for print readiness.
 * Ported from Frederick Apparel DTF Gang Sheet Builder.
 *
 * Grading is based on pixel dimensions (longest side):
 *   A (Print Ready):       Vector files, OR raster with 1500+ px longest side
 *   B (Good):              Raster with 1000–1499 px longest side
 *   C (Needs Improvement): Raster with 500–999 px longest side
 *   D (Poor):              Raster under 500 px longest side
 */

// ── Public types ──

export type GradientEdgeSeverity = 'none' | 'minor' | 'moderate' | 'heavy'

export type VectorizeComplexity = 'simple' | 'complex' | 'very_complex'

export interface ImageAnalysis {
  grade: 'A' | 'B' | 'C' | 'D'
  gradeLabel: string
  dpi: number
  dpiLabel: string
  dpiDetail: string
  fileTypeLabel: string
  hasTransparency: boolean
  isVector: boolean
  suggestBgRemoval: boolean
  suggestUpscale: boolean
  suggestVectorize: boolean
  gradientEdgePct: number
  gradientEdgeSeverity: GradientEdgeSeverity
  gradientEdgeLabel: string
  suggestCleanEdges: boolean
  vectorizeComplexity: VectorizeComplexity
  distinctColorGroups: number
  // Extra fields for Image Enhancer display
  transparentPixels: number
  semiTransparentPixels: number
  totalPixels: number
  printWidthInches: number
  printHeightInches: number
  nativeWidth: number
  nativeHeight: number
}

// ── Analysis logic ──

interface AnalyzeInput {
  fileName: string
  fileType: string
  objectUrl: string
  nativeWidth: number
  nativeHeight: number
}

export async function analyzeImage(input: AnalyzeInput): Promise<ImageAnalysis> {
  const ext = input.fileName.toLowerCase()
  const isSvg = ext.endsWith('.svg') || input.fileType === 'image/svg+xml'
    || input.objectUrl.startsWith('data:image/svg+xml')
  const isPdf = ext.endsWith('.pdf') || input.fileType === 'application/pdf'

  let fileTypeLabel: string
  if (isSvg) fileTypeLabel = 'SVG \u00b7 Vector'
  else if (isPdf) fileTypeLabel = 'PDF'
  else if (input.fileType === 'image/png' || ext.endsWith('.png')) fileTypeLabel = 'PNG'
  else if (input.fileType === 'image/jpeg' || ext.endsWith('.jpg') || ext.endsWith('.jpeg')) fileTypeLabel = 'JPEG'
  else fileTypeLabel = 'Image'

  const { nativeWidth, nativeHeight } = input
  const printWidthInches = nativeWidth / 300
  const printHeightInches = nativeHeight / 300

  // SVGs get automatic A grade
  if (isSvg) {
    return {
      grade: 'A', gradeLabel: 'Print Ready',
      dpi: 0, dpiLabel: 'Vector', dpiDetail: 'Resolution independent',
      fileTypeLabel, hasTransparency: true, isVector: true,
      suggestBgRemoval: false, suggestUpscale: false, suggestVectorize: false,
      gradientEdgePct: 0, gradientEdgeSeverity: 'none',
      gradientEdgeLabel: 'Vector \u2014 no edge issues', suggestCleanEdges: false,
      vectorizeComplexity: 'simple', distinctColorGroups: 0,
      transparentPixels: 0, semiTransparentPixels: 0, totalPixels: 0,
      printWidthInches, printHeightInches, nativeWidth, nativeHeight,
    }
  }

  // ── Raster analysis ──
  const longestSide = Math.max(nativeWidth, nativeHeight)
  const naturalPrintLongest = Math.max(printWidthInches, printHeightInches)

  const dpi = 300
  const dpiDetail = longestSide >= 1500
    ? `300 DPI at ${naturalPrintLongest.toFixed(1)}" wide`
    : longestSide >= 500
      ? `300 DPI at ${naturalPrintLongest.toFixed(1)}" — small print area`
      : `Only ${naturalPrintLongest.toFixed(1)}" at 300 DPI — very small`

  let dpiLabel: string
  if (longestSide >= 1500) dpiLabel = 'Excellent'
  else if (longestSide >= 1000) dpiLabel = 'Good'
  else if (longestSide >= 500) dpiLabel = 'Fair'
  else dpiLabel = 'Low Resolution'

  // Transparency + gradient edge detection
  const isPng = input.fileType === 'image/png' || ext.endsWith('.png')
  const isJpeg = input.fileType === 'image/jpeg' || ext.endsWith('.jpg') || ext.endsWith('.jpeg')
  const canHaveAlpha = isPng || isPdf

  let hasTransparency = false
  let gradientEdgePct = 0
  let transparentPixels = 0
  let semiTransparentPixels = 0
  let totalPixels = nativeWidth * nativeHeight

  if (canHaveAlpha) {
    const alphaResult = await analyzeAlphaChannel(input.objectUrl, nativeWidth, nativeHeight)
    hasTransparency = alphaResult.hasTransparency
    gradientEdgePct = alphaResult.semiTransparentPct
    transparentPixels = alphaResult.transparentCount
    semiTransparentPixels = alphaResult.semiTransparentCount
    totalPixels = alphaResult.totalPixels
  }

  // Classify gradient edge severity
  let gradientEdgeSeverity: GradientEdgeSeverity
  let gradientEdgeLabel: string
  if (gradientEdgePct === 0 || !hasTransparency) {
    gradientEdgeSeverity = 'none'
    gradientEdgeLabel = hasTransparency ? 'Clean edges' : 'No transparency'
  } else if (gradientEdgePct <= 5) {
    gradientEdgeSeverity = 'minor'
    gradientEdgeLabel = `Minor gradient edges (${gradientEdgePct.toFixed(1)}%)`
  } else if (gradientEdgePct <= 20) {
    gradientEdgeSeverity = 'moderate'
    gradientEdgeLabel = `Moderate gradient edges (${gradientEdgePct.toFixed(1)}%)`
  } else {
    gradientEdgeSeverity = 'heavy'
    gradientEdgeLabel = `Heavy gradients/feathering (${gradientEdgePct.toFixed(1)}%)`
  }

  const suggestCleanEdges = gradientEdgeSeverity === 'moderate' || gradientEdgeSeverity === 'heavy'

  // Vectorization complexity assessment
  let vectorizeComplexity: VectorizeComplexity = 'simple'
  let distinctColorGroups = 0
  if (!isPdf) {
    const complexityResult = await assessVectorizationComplexity(input.objectUrl, nativeWidth, nativeHeight)
    vectorizeComplexity = complexityResult.complexity
    distinctColorGroups = complexityResult.colorGroups
  }

  // Tool suggestions
  const suggestUpscale = !isPdf && longestSide < 3000
  const suggestBgRemoval = isJpeg || ((isPng || isPdf) && !hasTransparency)
  const suggestVectorize = !isPdf && vectorizeComplexity !== 'very_complex'

  // Grading
  let grade: ImageAnalysis['grade']
  if (longestSide >= 1500) grade = 'A'
  else if (longestSide >= 1000) grade = 'B'
  else if (longestSide >= 500) grade = 'C'
  else grade = 'D'

  const gradeLabel = grade === 'A' ? 'Print Ready'
    : grade === 'B' ? 'Good'
    : grade === 'C' ? 'Needs Improvement'
    : 'Poor Quality'

  return {
    grade, gradeLabel, dpi, dpiLabel, dpiDetail, fileTypeLabel,
    hasTransparency, isVector: false,
    suggestBgRemoval, suggestUpscale, suggestVectorize,
    gradientEdgePct, gradientEdgeSeverity, gradientEdgeLabel, suggestCleanEdges,
    vectorizeComplexity, distinctColorGroups,
    transparentPixels, semiTransparentPixels, totalPixels,
    printWidthInches, printHeightInches, nativeWidth, nativeHeight,
  }
}

// ── Vectorization complexity assessment ──

async function assessVectorizationComplexity(
  src: string, nativeWidth: number, nativeHeight: number,
): Promise<{ complexity: VectorizeComplexity; colorGroups: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = 256
      const scale = Math.min(1, maxDim / Math.max(nativeWidth, nativeHeight))
      const w = Math.max(1, Math.round(nativeWidth * scale))
      const h = Math.max(1, Math.round(nativeHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)

      const colorKeys = new Set<string>()
      let visiblePixels = 0
      let edgePixels = 0

      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const idx = (y * w + x) * 4
          if (data[idx + 3] === 0) continue
          visiblePixels++
          const r = data[idx], g = data[idx + 1], b = data[idx + 2]
          colorKeys.add(`${Math.round(r / 10)},${Math.round(g / 10)},${Math.round(b / 10)}`)

          if (x + 2 < w) {
            const nIdx = (y * w + x + 2) * 4
            if (data[nIdx + 3] > 0) {
              const diff = Math.abs(r - data[nIdx]) + Math.abs(g - data[nIdx + 1]) + Math.abs(b - data[nIdx + 2])
              if (diff > 80) edgePixels++
            }
          }
          if (y + 2 < h) {
            const nIdx = ((y + 2) * w + x) * 4
            if (data[nIdx + 3] > 0) {
              const diff = Math.abs(r - data[nIdx]) + Math.abs(g - data[nIdx + 1]) + Math.abs(b - data[nIdx + 2])
              if (diff > 80) edgePixels++
            }
          }
        }
      }

      const colorGroups = colorKeys.size
      const edgePct = visiblePixels > 0 ? (edgePixels / visiblePixels) * 100 : 0

      let complexity: VectorizeComplexity
      if (colorGroups >= 200) complexity = 'very_complex'
      else if (colorGroups < 50 && edgePct <= 10) complexity = 'simple'
      else complexity = 'complex'

      resolve({ complexity, colorGroups })
    }
    img.onerror = () => resolve({ complexity: 'complex', colorGroups: 0 })
    img.src = src
  })
}

// ── Alpha channel analysis ──

interface AlphaResult {
  hasTransparency: boolean
  semiTransparentPct: number
  transparentCount: number
  semiTransparentCount: number
  totalPixels: number
}

async function analyzeAlphaChannel(
  src: string, nativeWidth: number, nativeHeight: number,
): Promise<AlphaResult> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = 512
      const scale = Math.min(1, maxDim / Math.max(nativeWidth, nativeHeight))
      const w = Math.max(1, Math.round(nativeWidth * scale))
      const h = Math.max(1, Math.round(nativeHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)

      let fullyTransparent = 0, semiTransparent = 0
      const totalPixels = w * h

      for (let i = 3; i < data.length; i += 4) {
        if (data[i] === 0) fullyTransparent++
        else if (data[i] < 255) semiTransparent++
      }

      const hasTransparency = fullyTransparent > 0 || semiTransparent > 0
      const visiblePixels = totalPixels - fullyTransparent
      const semiTransparentPct = visiblePixels > 0 ? (semiTransparent / visiblePixels) * 100 : 0

      resolve({ hasTransparency, semiTransparentPct, transparentCount: fullyTransparent, semiTransparentCount: semiTransparent, totalPixels })
    }
    img.onerror = () => resolve({ hasTransparency: false, semiTransparentPct: 0, transparentCount: 0, semiTransparentCount: 0, totalPixels: 0 })
    img.src = src
  })
}

// ── Edge Heat Map Generator ──

export async function generateEdgeHeatmap(
  src: string, nativeWidth: number, nativeHeight: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = 1024
      const scale = Math.min(1, maxDim / Math.max(nativeWidth, nativeHeight))
      const w = Math.max(1, Math.round(nativeWidth * scale))
      const h = Math.max(1, Math.round(nativeHeight * scale))

      const srcCanvas = document.createElement('canvas')
      srcCanvas.width = w; srcCanvas.height = h
      const srcCtx = srcCanvas.getContext('2d')!
      srcCtx.drawImage(img, 0, 0, w, h)
      const srcData = srcCtx.getImageData(0, 0, w, h)

      const heatCanvas = document.createElement('canvas')
      heatCanvas.width = w; heatCanvas.height = h
      const heatCtx = heatCanvas.getContext('2d')!
      heatCtx.globalAlpha = 0.3
      heatCtx.drawImage(img, 0, 0, w, h)
      heatCtx.globalAlpha = 1

      const heatData = heatCtx.getImageData(0, 0, w, h)
      const srcPx = srcData.data
      const dst = heatData.data

      for (let i = 0; i < srcPx.length; i += 4) {
        const alpha = srcPx[i + 3]
        if (alpha === 0) {
          dst[i] = 0; dst[i + 1] = 0; dst[i + 2] = 0; dst[i + 3] = 0
        } else if (alpha < 255) {
          const severity = 1 - (alpha / 255)
          dst[i] = 255
          dst[i + 1] = Math.round(80 * (1 - severity))
          dst[i + 2] = 0
          dst[i + 3] = Math.max(180, Math.round(200 + 55 * severity))
        }
      }

      heatCtx.putImageData(heatData, 0, 0)
      resolve(heatCanvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load image for heat map'))
    img.src = src
  })
}
