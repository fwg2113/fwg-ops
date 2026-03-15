/**
 * Auto-crop transparent padding from PNG images.
 * Ported from Frederick Apparel DTF Gang Sheet Builder.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function trimTransparency(
  objectUrl: string,
  fileType: string,
): Promise<{ url: string; width: number; height: number; trimmed: boolean }> {
  if (!fileType.includes('png')) {
    const img = await loadImage(objectUrl)
    return { url: objectUrl, width: img.naturalWidth, height: img.naturalHeight, trimmed: false }
  }

  const img = await loadImage(objectUrl)
  const { width, height } = img

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  let minX = width, minY = height, maxX = 0, maxY = 0
  let hasTransparency = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 0) {
        if (minX > x) minX = x
        if (minY > y) minY = y
        if (maxX < x) maxX = x
        if (maxY < y) maxY = y
      } else {
        hasTransparency = true
      }
    }
  }

  if (!hasTransparency || maxX < minX || maxY < minY) {
    return { url: objectUrl, width, height, trimmed: false }
  }

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1

  if (width - cropW < 4 && height - cropH < 4) {
    return { url: objectUrl, width, height, trimmed: false }
  }

  const croppedCanvas = document.createElement('canvas')
  croppedCanvas.width = cropW
  croppedCanvas.height = cropH
  const croppedCtx = croppedCanvas.getContext('2d')!
  croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

  return { url: croppedCanvas.toDataURL('image/png'), width: cropW, height: cropH, trimmed: true }
}
