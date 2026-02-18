/**
 * DST (Tajima) Embroidery File Parser & Canvas Renderer
 *
 * Parses .dst binary stitch files and renders realistic stitch previews
 * on a canvas. The DST format encodes stitch positions as 3-byte commands
 * with bit-encoded X/Y deltas.
 *
 * Reference: pyembroidery (EmbroidePy), libembroidery (Embroidermodder)
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
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped + ':([^\\r\\n]*)')
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
 * DST bit layout (per pyembroidery DstReader.py):
 *
 * X uses balanced ternary (1,3,9,27,81) from lower bits of each byte.
 * Y uses the same system from upper bits, then is NEGATED.
 *
 * decode_dx:                          decode_dy (before negation):
 *   b0 bit 0: +1   b0 bit 1: -1       b0 bit 7: +1   b0 bit 6: -1
 *   b0 bit 2: +9   b0 bit 3: -9       b0 bit 5: +9   b0 bit 4: -9
 *   b1 bit 0: +3   b1 bit 1: -3       b1 bit 7: +3   b1 bit 6: -3
 *   b1 bit 2: +27  b1 bit 3: -27      b1 bit 5: +27  b1 bit 4: -27
 *   b2 bit 2: +81  b2 bit 3: -81      b2 bit 5: +81  b2 bit 4: -81
 *
 * Final dy = -y (pyembroidery negates the accumulated Y value)
 *
 * Command type from byte 2 (checked in priority order):
 *   (b2 & 0xF3) == 0xF3 → end
 *   (b2 & 0xC3) == 0xC3 → color change
 *   (b2 & 0x43) == 0x43 → sequin (treated as jump)
 *   (b2 & 0x83) == 0x83 → jump/move
 *   else → normal stitch
 */
function decodeStitchCommand(b0: number, b1: number, b2: number): StitchCommand {
  let x = 0
  let y = 0

  // X: lower bits of each byte (balanced ternary 1,3,9,27,81)
  if (b0 & 0x01) x += 1
  if (b0 & 0x02) x -= 1
  if (b0 & 0x04) x += 9
  if (b0 & 0x08) x -= 9
  if (b1 & 0x01) x += 3
  if (b1 & 0x02) x -= 3
  if (b1 & 0x04) x += 27
  if (b1 & 0x08) x -= 27
  if (b2 & 0x04) x += 81
  if (b2 & 0x08) x -= 81

  // Y: upper bits of each byte, then negated (balanced ternary 1,3,9,27,81)
  // pyembroidery accumulates y then returns -y, so effective signs are flipped
  if (b0 & 0x80) y -= 1
  if (b0 & 0x40) y += 1
  if (b0 & 0x20) y -= 9
  if (b0 & 0x10) y += 9
  if (b1 & 0x80) y -= 3
  if (b1 & 0x40) y += 3
  if (b1 & 0x20) y -= 27
  if (b1 & 0x10) y += 27
  if (b2 & 0x20) y -= 81
  if (b2 & 0x10) y += 81

  // Command type detection per pyembroidery's cascading bitmask checks.
  // Bits 0,1 of b2 are set for non-stitch commands; bits 6,7 distinguish which.
  // Normal stitches have bits 0,1 clear (or neither 0x83 nor 0x43 pattern).

  // End-of-file marker: all flag bits set, b0/b1 zero
  if (b0 === 0x00 && b1 === 0x00 && (b2 & 0xF3) === 0xF3) {
    return { x: 0, y: 0, type: 'end' }
  }

  let type: StitchCommand['type'] = 'stitch'

  if ((b2 & 0xC3) === 0xC3) {
    type = 'color_change'
  } else if ((b2 & 0x83) === 0x83) {
    type = 'jump'
  } else if ((b2 & 0x43) === 0x43) {
    // Sequin mode toggle - treat as jump
    type = 'jump'
  }

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
      if (stitches.length > segmentStart) {
        colorSegments.push({ startIdx: segmentStart, endIdx: stitches.length })
      }
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
 * Batches stitches into longer paths for performance (DST files can
 * have 10,000-50,000+ stitches).
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
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')

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
  // Y is flipped in DST (positive Y goes up in DST, down in canvas)
  const toCanvasY = (y: number) => size - (y * scale + offsetY)

  // Thread width scales with design size
  const threadWidth = Math.max(1.2, Math.min(3.5, size / 300))

  // Render each color segment - batch stitches into paths for performance
  colorSegments.forEach((segment, segIdx) => {
    const color = threadColor || DEFAULT_PALETTE[segIdx % DEFAULT_PALETTE.length]

    ctx.strokeStyle = color
    ctx.lineWidth = threadWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    let pathStarted = false

    for (let i = segment.startIdx; i < segment.endIdx; i++) {
      const stitch = stitches[i]

      if (stitch.type === 'jump' || stitch.type === 'color_change') {
        // Stroke what we have so far, then break the path
        if (pathStarted) {
          ctx.stroke()
          ctx.beginPath()
          pathStarted = false
        }
        continue
      }

      const sx = toCanvasX(stitch.x)
      const sy = toCanvasY(stitch.y)

      if (!pathStarted) {
        ctx.moveTo(sx, sy)
        pathStarted = true
      } else {
        ctx.lineTo(sx, sy)
      }
    }

    // Stroke any remaining path
    if (pathStarted) {
      ctx.stroke()
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

  // Debug: log parse results and raw stitch bytes
  const typeCounts = { stitch: 0, jump: 0, color_change: 0, end: 0 }
  for (const s of design.stitches) typeCounts[s.type]++
  const raw = new Uint8Array(buffer)
  const sampleStitches: string[] = []
  for (let i = 512; i < Math.min(512 + 30, raw.length); i += 3) {
    const b0 = raw[i], b1 = raw[i + 1], b2 = raw[i + 2]
    sampleStitches.push(
      `[${b0.toString(16).padStart(2,'0')} ${b1.toString(16).padStart(2,'0')} ${b2.toString(16).padStart(2,'0')}] b2bits=${b2.toString(2).padStart(8,'0')} b2&03=${(b2&3)}`
    )
  }
  console.log('[DST]', file.name, {
    header: design.header,
    totalCommands: design.stitches.length,
    types: typeCounts,
    bounds: design.bounds,
    segments: design.colorSegments.length,
    firstStitchBytes: sampleStitches,
  })

  return renderDSTToCanvas(design, size, threadColor)
}
