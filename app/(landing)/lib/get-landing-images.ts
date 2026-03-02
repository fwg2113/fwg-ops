import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { unstable_cache } from 'next/cache'

// ─── Landing Page Image Discovery ───
// Scans the fwg-landing R2 bucket and finds images by folder structure.
// The user just creates folders in Cloudflare and drops any photo in.
// No renaming needed — the code finds whatever file is in each folder.
//
// Folder structure in the fwg-landing bucket:
//
//   {page-slug}/hero/           ← hero background for that page
//   {page-slug}/service-1/      ← first service card image
//   {page-slug}/service-2/      ← second service card image
//   {page-slug}/service-3/      ← third service card image
//   {page-slug}/service-4/      ← fourth service card image
//   before-after/before-1/      ← before photo for first slider
//   before-after/after-1/       ← after photo for first slider
//   before-after/before-2/      ← before photo for second slider
//   before-after/after-2/       ← after photo for second slider
//   before-after/before-3/      ← before photo for third slider
//   before-after/after-3/       ← after photo for third slider

const R2_PUBLIC_BASE = 'https://pub-fc53e761336c467eb14e978df4383491.r2.dev'
const LANDING_BUCKET = 'fwg-landing'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function isImage(key: string): boolean {
  const lower = key.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// Lists all objects in the landing bucket and groups them by folder.
// Returns a map like: { "commercial-vehicle-wraps/hero": "https://pub-xxx/..." }
// Cached for 60 seconds so it doesn't hit R2 on every page view.
async function _listLandingImages(): Promise<Record<string, string>> {
  try {
    const result = await S3.send(new ListObjectsV2Command({
      Bucket: LANDING_BUCKET,
    }))

    const images: Record<string, string> = {}

    for (const obj of result.Contents ?? []) {
      if (!obj.Key || !isImage(obj.Key)) continue

      // Key looks like: "commercial-vehicle-wraps/hero/IMG_1234.jpg"
      // We want the folder: "commercial-vehicle-wraps/hero"
      const lastSlash = obj.Key.lastIndexOf('/')
      if (lastSlash === -1) continue

      const folder = obj.Key.substring(0, lastSlash)

      // Only keep the first image per folder
      if (!images[folder]) {
        images[folder] = `${R2_PUBLIC_BASE}/${obj.Key}`
      }
    }

    return images
  } catch (error) {
    console.error('Failed to list landing images from R2:', error)
    return {}
  }
}

export const getLandingImages = unstable_cache(
  _listLandingImages,
  ['landing-images'],
  { revalidate: 60 }
)

// Helper: get all images organized for a specific page
export async function getPageImages(pageSlug: string) {
  const all = await getLandingImages()

  return {
    hero: all[`${pageSlug}/hero`] as string | undefined,
    services: [
      all[`${pageSlug}/service-1`],
      all[`${pageSlug}/service-2`],
      all[`${pageSlug}/service-3`],
      all[`${pageSlug}/service-4`],
    ] as (string | undefined)[],
    beforeAfter: [
      { before: all['before-after/before-1'], after: all['before-after/after-1'] },
      { before: all['before-after/before-2'], after: all['before-after/after-2'] },
      { before: all['before-after/before-3'], after: all['before-after/after-3'] },
    ] as { before?: string; after?: string }[],
  }
}
