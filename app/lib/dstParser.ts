/**
 * DST (Tajima) Embroidery File Parser & Canvas Renderer
 *
 * Parses .dst binary stitch files and renders realistic stitch previews
 * on a canvas. The DST format encodes stitch positions as 3-byte commands
 * with bit-encoded X/Y deltas.
 *
 * Reference: https://edutechwiki.unige.ch/en/Embroidery_format_DST
 */

interface DSTHeader {
  label: string
  stitchCount: number
  colorChanges: number
  extentPlusX: number
  extentPlusY: number
  extentMinusX: number
  extentMinusY: number
}

interface StitchCommand {
  x: number
  y: number
  type: 'stitch' | 'jump' | 'color_change' | 'end'
}

interface DSTDesign {
  header: DSTHeader
  stitches: StitchCommand[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  colorSegments: { startIdx: number; endIdx: number }[]
}

/**
 * Parse DST header from first 512 bytes
 */
function parseDSTHeader(data: Uint8Array): DSTHeader {
  const decoder = new TextDecoder('ascii')
  const headerText = decoder.decode(data.slice(0, 512))

  const getValue = (key: string): string => {
    const regex = new RegExp(key + ':([^\\r\\n]*)')
    const match = headerText.match(regex)
    return match ? match[1].trim() : ''
  }

  return {
    label: getValue('LA').replace(/\s+$/, ''),
    stitchCount: parseInt(getValue('ST')) || 0,
    colorChanges: parseInt(getValue('CO')) || 0,
    extentPlusX: parseInt(getValue('+X')) || 0,
    extentPlusY: parseInt(getValue('+Y')) || 0,
    extentMinusX: parseInt(getValue('-X')) || 0,
    extentMinusY: parseInt(getValue('-Y')) || 0,
  }
}

/**
 * Decode a 3-byte DST stitch command into X/Y deltas and command type.
 *
 * Each byte contributes bits to the X and Y movement:
 * - Byte 1 bits: y+1, y-1, y+9, y-9, x-9, x+9, x-1, x+1
 * - Byte 2 bits: y+3, y-3, y+27, y-27, x-27, x+27, x-3, x+3
 * - Byte 3 bits: y+81, y-81, cmd1, cmd0, x-81, x+81, ?, ?
 */
function decodeStitchCommand(b0: number, b1: number, b2: number): StitchCommand {
  let x = 0
  let y = 0

  // Byte 0
  if (b0 & 0x01) x += 1
  if (b0 & 0x02) x -= 1
  if (b0 & 0x04) x += 9
  if (b0 & 0x08) x -= 9
  if (b0 & 0x80) y += 1
  if (b0 & 0x40) y -= 1
  if (b0 & 0x20) y += 9
  if (b0 & 0x10) y -= 9

  // Byte 1
  if (b1 & 0x01) x += 3
  if (b1 & 0x02) x -= 3
  if (b1 & 0x04) x += 27
  if (b1 & 0x08) x -= 27
  if (b1 & 0x80) y += 3
  if (b1 & 0x40) y -= 3
  if (b1 & 0x20) y += 27
  if (b1 & 0x10) y -= 27

  // Byte 2
  if (b2 & 0x04) x += 81
  if (b2 & 0x08) x -= 81
  if (b2 & 0x20) y += 81
  if (b2 & 0x40) y -= 81

  // Command type from top 2 bits of byte 2
  const cmd = (b2 >> 6) & 0x03
  // Also check for end-of-file marker
  if (b0 === 0x00 && b1 === 0x00 && (b2 & 0xF3) === 0xF3) {
    return { x: 0, y: 0, type: 'end' }
  }

  let type: StitchCommand['type'] = 'stitch'
  if (cmd === 1) type = 'jump'
  else if (cmd === 2) type = 'color_change'
  else if (cmd === 3) type = 'end'

  return { x, y, type }
}

/**
 * Parse a complete DST file from an ArrayBuffer
 */
export function parseDST(buffer: ArrayBuffer): DSTDesign {
  const data = new Uint8Array(buffer)
  const header = parseDSTHeader(data)

  const stitches: StitchCommand[] = []
  let curX = 0
  let curY = 0
  let minX = 0, minY = 0, maxX = 0, maxY = 0

  const colorSegments: { startIdx: number; endIdx: number }[] = []
  let segmentStart = 0

  // Stitch data starts at byte 512
  for (let i = 512; i + 2 < data.length; i += 3) {
    const cmd = decodeStitchCommand(data[i], data[i + 1], data[i + 2])

    if (cmd.type === 'end') break

    curX += cmd.x
    curY += cmd.y

    if (cmd.type === 'color_change') {
      colorSegments.push({ startIdx: segmentStart, endIdx: stitches.length })
      segmentStart = stitches.length
    }

    stitches.push({ x: curX, y: curY, type: cmd.type })

    if (curX < minX) minX = curX
    if (curY < minY) minY = curY
    if (curX > maxX) maxX = curX
    if (curY > maxY) maxY = curY
  }

  // Close last segment
  if (stitches.length > segmentStart) {
    colorSegments.push({ startIdx: segmentStart, endIdx: stitches.length })
  }

  return {
    header,
    stitches,
    bounds: { minX, minY, maxX, maxY },
    colorSegments: colorSegments.length > 0 ? colorSegments : [{ startIdx: 0, endIdx: stitches.length }]
  }
}

/**
 * Default thread color palette (common embroidery thread colors)
 */
const DEFAULT_PALETTE = [
  '#1a1a8b', // Navy
  '#cc0000', // Red
  '#006600', // Green
  '#cc6600', // Orange
  '#660066', // Purple
  '#006666', // Teal
  '#8b4513', // Brown
  '#333333', // Dark Gray
  '#cc0066', // Magenta
  '#0066cc', // Blue
  '#669900', // Olive
  '#cc3300', // Vermillion
]

/**
 * Render a parsed DST design to a canvas and return as a data URL.
 *
 * @param design - Parsed DST design from parseDST()
 * @param size - Output canvas size in pixels (square)
 * @param threadColor - Primary thread color (overrides palette for single-color rendering)
 * @param backgroundColor - Background color ('transparent' for transparent)
 * @returns data URL of the rendered stitch preview
 */
export function renderDSTToCanvas(
  design: DSTDesign,
  size: number = 800,
  threadColor?: string,
  backgroundColor: string = 'transparent'
): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Background
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, size, size)
  }

  const { bounds, stitches, colorSegments } = design
  const designWidth = bounds.maxX - bounds.minX
  const designHeight = bounds.maxY - bounds.minY

  if (designWidth === 0 || designHeight === 0 || stitches.length === 0) {
    return canvas.toDataURL('image/png')
  }

  // Scale to fit canvas with padding
  const padding = size * 0.08
  const availableSize = size - padding * 2
  const scale = Math.min(availableSize / designWidth, availableSize / designHeight)
  const offsetX = (size - designWidth * scale) / 2 - bounds.minX * scale
  const offsetY = (size - designHeight * scale) / 2 - bounds.minY * scale

  const toCanvasX = (x: number) => x * scale + offsetX
  // Y is flipped in DST (positive Y is down in screen coords)
  const toCanvasY = (y: number) => size - (y * scale + offsetY)

  // Thread width scales with design size
  const threadWidth = Math.max(1.5, Math.min(4, size / 250))

  // Render each color segment
  colorSegments.forEach((segment, segIdx) => {
    const color = threadColor || DEFAULT_PALETTE[segIdx % DEFAULT_PALETTE.length]

    ctx.strokeStyle = color
    ctx.lineWidth = threadWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    let isDrawing = false

    for (let i = segment.startIdx; i < segment.endIdx; i++) {
      const stitch = stitches[i]

      if (stitch.type === 'jump' || stitch.type === 'color_change') {
        // Jump/color change - move without drawing
        isDrawing = false
        continue
      }

      const sx = toCanvasX(stitch.x)
      const sy = toCanvasY(stitch.y)

      if (!isDrawing) {
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        isDrawing = true
      } else {
        ctx.lineTo(sx, sy)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(sx, sy)
      }
    }
  })

  return canvas.toDataURL('image/png')
}

/**
 * Parse and render a DST file from a File object.
 * Returns a data URL of the stitch preview.
 */
export async function renderDSTFile(
  file: File,
  size: number = 800,
  threadColor?: string
): Promise<string> {
  const buffer = await file.arrayBuffer()
  const design = parseDST(buffer)
  return renderDSTToCanvas(design, size, threadColor)
}
