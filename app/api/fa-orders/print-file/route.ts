import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'fwg-uploads'
const ASSETS_BASE = 'https://assets.frederickapparel.com'

/**
 * GET /api/fa-orders/print-file?session_token=xxx
 *
 * Lists all files in fa/artwork/{session_token}/print-ready/ and returns:
 * - key, url: the gang sheet PDF (first .pdf found) — for backward compatibility
 * - files[]: all files (PDF + individual artwork files)
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.nextUrl.searchParams.get('session_token')

  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token is required' }, { status: 400 })
  }

  try {
    const prefix = `fa/artwork/${sessionToken}/print-ready/`

    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: 50,
    }))

    const allFiles = (result.Contents || [])
      .filter(obj => obj.Key && obj.Key !== prefix)
      .map(obj => {
        const key = obj.Key!
        const name = key.split('/').pop() ?? key
        const isPdf = name.endsWith('.pdf')
        return {
          key,
          name,
          url: `${ASSETS_BASE}/${key}`,
          type: isPdf ? 'gang-sheet' as const : 'individual' as const,
          sizeBytes: obj.Size ?? 0,
          lastModified: obj.LastModified?.getTime() ?? 0,
        }
      })

    if (allFiles.length === 0) {
      return NextResponse.json({ error: 'No print file found' }, { status: 404 })
    }

    // Find the most recent gang sheet PDF (sorted by last modified, descending)
    const gangSheetPdfs = allFiles
      .filter(f => f.type === 'gang-sheet')
      .sort((a, b) => b.lastModified - a.lastModified)
    const gangSheetPdf = gangSheetPdfs[0] ?? null
    const individualFiles = allFiles.filter(f => f.type === 'individual')

    return NextResponse.json({
      // Backward compatible — existing UI reads these
      key: gangSheetPdf?.key ?? allFiles[0].key,
      url: gangSheetPdf?.url ?? allFiles[0].url,
      // New: all files for enhanced UI
      files: allFiles,
      gangSheet: gangSheetPdf ?? null,
      individualFiles,
    })
  } catch (error) {
    console.error('Print file lookup error:', error)
    return NextResponse.json({ error: 'Failed to look up print file' }, { status: 500 })
  }
}
