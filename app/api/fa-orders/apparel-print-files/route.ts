import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb } from 'pdf-lib'
import opentype from 'opentype.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LOG = '[apparel-print-files]'
const PTS_PER_INCH = 72
const DEFAULT_WIDTH_INCHES = 10

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'fwg-uploads'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://assets.frederickwraps.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Types ──

interface TextElement {
  id: string
  text: string
  fontFamily: string
  fontSize: number
  color: string
  fontWeight: number
  strokeColor: string
  strokeWidth: number
  strokeJoin?: string
  offsetPathWidth: number
  offsetPathColor: string
  textAlign: string
  lineSpacing: number
  rotation: number
  location: string
  sourceProjectFile?: string
  isVariable?: boolean
  variableName?: string
}

interface Logo {
  id: string
  url: string
  originalUrl: string
  isSvg: boolean
  svgContent?: string
  location: string
  backgroundRemoved: boolean
}

interface MockupConfig {
  logos?: Logo[]
  textElements?: TextElement[]
}

interface ArtworkPiece {
  key: string
  name: string
  type: 'text' | 'logo'
  totalQty: number
  textElement?: TextElement
  logo?: Logo
}

// ── Font loading ──

const fontCache = new Map<string, opentype.Font>()

async function loadFont(family: string, weight: number): Promise<opentype.Font | null> {
  const wght = weight >= 700 ? '700' : weight >= 500 ? '500' : '400'
  const cacheKey = `${family}-${wght}`
  if (fontCache.has(cacheKey)) return fontCache.get(cacheKey)!

  try {
    const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${wght}`
    const cssRes = await fetch(cssUrl, { cache: 'no-store', headers: { 'User-Agent': 'curl/8.0' } })
    const cssText = await cssRes.text()
    const urlMatch = cssText.match(/url\(([^)]+\.ttf)\)/) || cssText.match(/url\(([^)]+)\)/)
    if (!urlMatch) return null

    const fontRes = await fetch(urlMatch[1], { cache: 'no-store' })
    if (!fontRes.ok) return null

    const buffer = await fontRes.arrayBuffer()
    const font = opentype.parse(buffer)
    fontCache.set(cacheKey, font)
    return font
  } catch (err) {
    console.warn(LOG, `Failed to load font ${family} ${wght}:`, err)
    return null
  }
}

// ── Identity keys for dedup ──

function textIdentityKey(t: TextElement): string {
  if (t.sourceProjectFile) return `text:${t.sourceProjectFile}`
  return `text:${t.text}|${t.fontFamily}|${t.fontSize}|${t.color}|${t.fontWeight}|${t.strokeColor}|${t.strokeWidth}|${t.offsetPathWidth}|${t.offsetPathColor}`
}

function logoIdentityKey(l: Logo): string {
  return `logo:${l.originalUrl || l.url}`
}

// ── Color parsing ──

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', navy: '#000080', teal: '#008080',
  lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff', pink: '#ffc0cb', brown: '#a52a2a',
  maroon: '#800000', olive: '#808000',
}

function parseColor(color: string) {
  if (!color || color === 'none' || color === 'transparent' || color === 'inherit' || color === 'currentColor') return null
  const c = color.trim().toLowerCase()

  // Named color
  if (NAMED_COLORS[c]) return hexToRgb(NAMED_COLORS[c])

  // #RGB shorthand
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return hexToRgb(`#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`)
  }

  // #RRGGBB
  if (/^#[0-9a-f]{6}$/i.test(c)) return hexToRgb(c)

  // rgb(r,g,b)
  const rgbMatch = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    return rgb(Number(rgbMatch[1]) / 255, Number(rgbMatch[2]) / 255, Number(rgbMatch[3]) / 255)
  }

  return null
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

// ── Generate text PDF using pdf-lib + opentype.js ──

async function generateTextPdf(text: TextElement): Promise<Uint8Array> {
  const font = await loadFont(text.fontFamily, text.fontWeight || 400)
  const displayText = text.text || 'Text'
  const lines = displayText.split('\n')
  const lineHeight = text.fontSize * (text.lineSpacing || 1.25)
  const hasStroke = text.strokeWidth > 0
  const hasOffset = (text.offsetPathWidth || 0) > 0

  // Measure text width
  let maxLineWidth = 0
  if (font) {
    for (const line of lines) {
      const w = font.getAdvanceWidth(line || ' ', text.fontSize)
      maxLineWidth = Math.max(maxLineWidth, w)
    }
  } else {
    maxLineWidth = Math.max(...lines.map(l => (l.length || 1) * text.fontSize * 0.6))
  }

  const extraPadding = (text.strokeWidth + (text.offsetPathWidth || 0)) * 2 + 4
  const contentWidth = maxLineWidth + extraPadding
  const contentHeight = text.fontSize + (lines.length - 1) * lineHeight + extraPadding

  // Scale so content is 10" wide
  const scale = (DEFAULT_WIDTH_INCHES * PTS_PER_INCH) / contentWidth
  const pageW = DEFAULT_WIDTH_INCHES * PTS_PER_INCH
  const pageH = contentHeight * scale

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageW, pageH])

  if (!font) {
    // Fallback: can't generate vector text without opentype font
    // Draw a placeholder rectangle
    page.drawRectangle({ x: 10, y: 10, width: pageW - 20, height: pageH - 20, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1 })
    console.warn(LOG, `Font ${text.fontFamily} not available, PDF will be empty`)
    return pdfDoc.save()
  }

  // Build path data for each line
  const unitsPerEm = font.unitsPerEm || 1000
  const fontAscent = (font.ascender / unitsPerEm) * text.fontSize
  const baselineFromTop = fontAscent + extraPadding / 2

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || ' '
    const lineY = baselineFromTop + i * lineHeight
    const lineWidth = font.getAdvanceWidth(line, text.fontSize)
    const align = text.textAlign || 'center'
    let lineX = extraPadding / 2
    if (align === 'center') lineX = (contentWidth - lineWidth) / 2
    else if (align === 'right') lineX = contentWidth - lineWidth - extraPadding / 2

    const path = font.getPath(line, lineX, lineY, text.fontSize)
    const pathData = path.toPathData(2)
    if (!pathData || pathData === 'M0 0') continue

    // pdf-lib uses bottom-left origin; SVG uses top-left
    // We need to flip Y: pdf_y = pageH - svg_y
    // drawSvgPath with scale handles the coordinate transform

    // Layer 1: Offset path (bottom)
    if (hasOffset) {
      const totalRadius = (text.offsetPathWidth || 0) + (hasStroke ? text.strokeWidth : 0)
      page.drawSvgPath(pathData, {
        x: 0,
        y: pageH,
        scale,
        borderColor: hexToRgb(text.offsetPathColor || '#000000'),
        borderWidth: totalRadius * 2, // scale transform in drawSvgPath scales this too
        borderLineCap: 1,
      })
    }

    // Layer 2: Stroke (middle)
    if (hasStroke) {
      page.drawSvgPath(pathData, {
        x: 0,
        y: pageH,
        scale,
        borderColor: hexToRgb(text.strokeColor || '#000000'),
        borderWidth: text.strokeWidth * 2, // scale transform in drawSvgPath scales this too
        borderLineCap: 1,
      })
    }

    // Layer 3: Fill (top)
    page.drawSvgPath(pathData, {
      x: 0,
      y: pageH,
      scale,
      color: hexToRgb(text.color || '#000000'),
    })
  }

  return pdfDoc.save()
}

// ── Generate logo PDF using pdf-lib ──

async function generateLogoPdf(logo: Logo): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  // If SVG with path data, try to extract and draw paths
  if (logo.svgContent) {
    // Parse SVG dimensions
    const vbMatch = logo.svgContent.match(/viewBox="([^"]+)"/)
    const widthMatch = logo.svgContent.match(/width="([^"]+)"/)
    const heightMatch = logo.svgContent.match(/height="([^"]+)"/)

    let svgW = 100, svgH = 100
    if (vbMatch) {
      const parts = vbMatch[1].split(/\s+/).map(Number)
      if (parts.length >= 4) { svgW = parts[2]; svgH = parts[3] }
    } else if (widthMatch && heightMatch) {
      svgW = parseFloat(widthMatch[1]) || 100
      svgH = parseFloat(heightMatch[1]) || 100
    }

    const aspectRatio = svgW / svgH
    const pageW = DEFAULT_WIDTH_INCHES * PTS_PER_INCH
    const pageH = pageW / aspectRatio
    const scale = pageW / svgW
    const page = pdfDoc.addPage([pageW, pageH])

    // Parse inherited properties from parent <g> elements
    let inheritedFill: string | null = null
    let inheritedStroke: string | null = null
    let inheritedStrokeWidth: string | null = null
    const gMatch = logo.svgContent.match(/<g\s[^>]*>/)
    if (gMatch) {
      const gTag = gMatch[0]
      const gFill = gTag.match(/\bfill="([^"]+)"/)
      const gStroke = gTag.match(/\bstroke="([^"]+)"/)
      const gStrokeWidth = gTag.match(/\bstroke-width="([^"]+)"/)
      if (gFill) inheritedFill = gFill[1]
      if (gStroke) inheritedStroke = gStroke[1]
      if (gStrokeWidth) inheritedStrokeWidth = gStrokeWidth[1]
    }

    // Extract all <path> elements — use dotAll flag for multi-line d="" values
    const pathRegex = /<path\s([\s\S]*?)\/>/g
    let match
    let drawnPaths = 0
    while ((match = pathRegex.exec(logo.svgContent)) !== null) {
      const attrs = match[1]

      // Extract d="" (may contain newlines)
      const dMatch = attrs.match(/\bd="([\s\S]*?)"/)
      if (!dMatch) continue
      const d = dMatch[1].replace(/\n/g, ' ').trim()
      if (!d || d === 'M0 0') continue

      // Extract fill (element > inherited > SVG default black)
      const fillAttr = attrs.match(/\bfill="([^"]+)"/)
      const styleMatch = attrs.match(/\bstyle="([^"]+)"/)
      const styleFill = styleMatch?.[1]?.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/)
      const fillStr = styleFill?.[1]?.trim() || fillAttr?.[1] || inheritedFill
      const noFill = fillStr === 'none'

      // Extract stroke (element > inherited)
      const strokeAttr = attrs.match(/\bstroke="([^"]+)"/)
      const styleStroke = styleMatch?.[1]?.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/)
      const strokeStr = styleStroke?.[1]?.trim() || strokeAttr?.[1] || inheritedStroke

      const strokeWidthAttr = attrs.match(/\bstroke-width="([^"]+)"/)
      const styleStrokeWidth = styleMatch?.[1]?.match(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/)
      const strokeWidthStr = styleStrokeWidth?.[1]?.trim() || strokeWidthAttr?.[1] || inheritedStrokeWidth

      try {
        const options: Record<string, unknown> = { x: 0, y: pageH, scale }

        if (!noFill && fillStr) {
          const fillColor = parseColor(fillStr)
          if (fillColor) options.color = fillColor
        } else if (!noFill) {
          options.color = rgb(0, 0, 0) // SVG default
        }

        if (strokeStr && strokeStr !== 'none') {
          const strokeColor = parseColor(strokeStr)
          if (strokeColor) {
            options.borderColor = strokeColor
            options.borderWidth = parseFloat(strokeWidthStr || '1')
          }
        }

        page.drawSvgPath(d, options)
        drawnPaths++
      } catch {
        // Some paths may not be parseable by pdf-lib — skip
      }
    }

    console.log(LOG, `Drew ${drawnPaths} SVG paths`)

    return pdfDoc.save()
  }

  // Raster logo — embed PNG/JPEG
  const imageUrl = logo.url || logo.originalUrl
  if (!imageUrl || imageUrl.startsWith('blob:')) {
    throw new Error('Logo URL is a browser blob — not accessible server-side. Re-save the mockup to persist the image.')
  }

  console.log(LOG, `Fetching logo: ${imageUrl.substring(0, 100)}...`)

  let buffer: ArrayBuffer
  if (imageUrl.startsWith('data:')) {
    // Data URL — decode base64
    const base64Part = imageUrl.split(',')[1]
    if (!base64Part) throw new Error('Invalid data URL')
    buffer = Buffer.from(base64Part, 'base64').buffer
  } else {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status} from ${imageUrl.substring(0, 100)}`)
    buffer = await res.arrayBuffer()
  }

  const bytes = new Uint8Array(buffer)

  let image
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    image = await pdfDoc.embedPng(bytes)
  } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    image = await pdfDoc.embedJpg(bytes)
  } else {
    // Try PNG first, fallback to JPG
    try {
      image = await pdfDoc.embedPng(bytes)
    } catch {
      image = await pdfDoc.embedJpg(bytes)
    }
  }

  const aspectRatio = image.width / image.height
  const pageW = DEFAULT_WIDTH_INCHES * PTS_PER_INCH
  const pageH = pageW / aspectRatio
  const page = pdfDoc.addPage([pageW, pageH])
  page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH })

  return pdfDoc.save()
}

// ── Main endpoint ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { documentId: string; lineItemIds?: string[] }

    if (!body.documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    console.log(LOG, 'Generating for document:', body.documentId)
    const supabase = getSupabase()

    const { data: lineItems, error } = await supabase
      .from('line_items')
      .select('id, description, quantity, custom_fields, attachments')
      .eq('document_id', body.documentId)
      .not('custom_fields->apparel_mode', 'is', null)

    if (error) throw error
    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: 'No apparel line items found' }, { status: 404 })
    }

    const items = body.lineItemIds
      ? lineItems.filter(li => body.lineItemIds!.includes(li.id))
      : lineItems

    // Collect artwork pieces with quantities
    const artworkMap = new Map<string, ArtworkPiece>()

    for (const li of items) {
      const config = li.custom_fields?.mockup_config as MockupConfig | undefined
      if (!config) continue

      const sizes = li.custom_fields?.sizes as Record<string, unknown> | undefined
      let lineQty = 0
      if (sizes) {
        for (const v of Object.values(sizes)) {
          if (typeof v === 'number') lineQty += v
          else if (typeof v === 'object' && v && 'qty' in v) lineQty += Number((v as { qty: number }).qty) || 0
          else lineQty += Number(v) || 0
        }
      }
      if (lineQty === 0) lineQty = Number(li.quantity) || 1

      for (const text of config.textElements || []) {
        if (text.isVariable) continue
        const key = textIdentityKey(text)
        const existing = artworkMap.get(key)
        if (existing) {
          existing.totalQty += lineQty
        } else {
          const name = text.text.replace(/\n/g, ' ').slice(0, 40).trim() || 'Text'
          artworkMap.set(key, { key, name, type: 'text', totalQty: lineQty, textElement: text })
        }
      }

      for (const logo of config.logos || []) {
        const key = logoIdentityKey(logo)
        const existing = artworkMap.get(key)
        if (existing) {
          existing.totalQty += lineQty
        } else {
          const urlParts = (logo.url || logo.originalUrl || '').split('/')
          const name = urlParts[urlParts.length - 1]?.replace(/[_-]/g, ' ')?.replace(/\.[^.]+$/, '')?.slice(0, 40) || 'Logo'
          artworkMap.set(key, { key, name, type: 'logo', totalQty: lineQty, logo })
        }
      }
    }

    if (artworkMap.size === 0) {
      return NextResponse.json({ error: 'No artwork found in mockup configs' }, { status: 404 })
    }

    console.log(LOG, `Found ${artworkMap.size} unique artwork pieces`)

    const results: Array<{ name: string; url: string; qty: number; type: string }> = []
    const errors: string[] = []

    for (const piece of artworkMap.values()) {
      try {
        let pdfBytes: Uint8Array
        const safeName = piece.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-') || 'artwork'
        const filename = `${safeName}_qty-${piece.totalQty}.pdf`

        if (piece.type === 'text' && piece.textElement) {
          pdfBytes = await generateTextPdf(piece.textElement)
          console.log(LOG, `Generated text PDF: ${filename} (${(pdfBytes.length / 1024).toFixed(0)} KB)`)
        } else if (piece.type === 'logo' && piece.logo) {
          pdfBytes = await generateLogoPdf(piece.logo)
          console.log(LOG, `Generated logo PDF: ${filename} (${(pdfBytes.length / 1024).toFixed(0)} KB)`)
        } else {
          continue
        }

        const key = `fwg-ops/apparel-print-files/${body.documentId}/${Date.now()}-${filename}`
        await S3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: Buffer.from(pdfBytes),
          ContentType: 'application/pdf',
        }))

        const url = `${R2_PUBLIC_URL}/${key}`
        results.push({ name: filename, url, qty: piece.totalQty, type: piece.type })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(LOG, `Failed to generate ${piece.name}:`, msg, err)
        errors.push(`${piece.name}: ${msg}`)
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'Failed to generate any print files', details: errors, artworkCount: artworkMap.size }, { status: 500 })
    }

    console.log(LOG, `Generated ${results.length} print files`)
    return NextResponse.json({ success: true, files: results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(LOG, 'Error:', msg, err)
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}
