'use client'

/**
 * Convert the first page of a PDF file to a PNG image.
 * Renders with transparent background and auto-trims to the artwork bounding box.
 * Returns a data URL (base64) and a new File object with .png extension.
 */
export async function pdfToImage(
  file: File,
  scale = 3 // High resolution for quality
): Promise<{ dataUrl: string; file: File; width: number; height: number }> {
  const pdfjsLib = await import('pdfjs-dist')

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)

  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')!

  // Transparent background — lets vector artwork stay clean
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    background: 'rgba(0,0,0,0)',
  }).promise

  // Auto-trim: find the bounding box of non-transparent pixels
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width: imgW, height: imgH } = imageData
  let minX = imgW, minY = imgH, maxX = 0, maxY = 0

  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      if (data[(y * imgW + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  // Clean up pdf.js resources
  page.cleanup()
  await pdf.destroy()

  let finalCanvas = canvas
  let finalW = canvas.width
  let finalH = canvas.height

  // Crop to bounding box if we found visible pixels
  if (maxX >= minX && maxY >= minY) {
    const cropW = maxX - minX + 1
    const cropH = maxY - minY + 1
    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = cropW
    croppedCanvas.height = cropH
    const croppedCtx = croppedCanvas.getContext('2d')!
    croppedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
    finalCanvas = croppedCanvas
    finalW = cropW
    finalH = cropH
  }

  const dataUrl = finalCanvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve) =>
    finalCanvas.toBlob((b) => resolve(b!), 'image/png')
  )

  const pngName = file.name.replace(/\.pdf$/i, '.png')
  const pngFile = new File([blob], pngName, { type: 'image/png' })

  return { dataUrl, file: pngFile, width: finalW, height: finalH }
}
