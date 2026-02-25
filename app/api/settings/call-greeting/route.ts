import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// Helper: save recording to DB, handling missing greeting_type column gracefully
async function saveRecording(name: string, url: string, r2Key: string, greetingType: string) {
  // Try deactivating existing recordings of the same type
  const deactivate = supabase
    .from('greeting_recordings')
    .update({ is_active: false })
    .eq('is_active', true)

  // Try with greeting_type column first
  const { error: deactErr } = await deactivate.eq('greeting_type', greetingType)
  if (deactErr?.message?.includes('greeting_type')) {
    // Column doesn't exist — deactivate all active recordings instead
    await supabase
      .from('greeting_recordings')
      .update({ is_active: false })
      .eq('is_active', true)
  }

  // Insert — try with greeting_type first
  const { data: recording, error: insertErr } = await supabase
    .from('greeting_recordings')
    .insert({ name, url, r2_key: r2Key, is_active: true, greeting_type: greetingType })
    .select()
    .single()

  if (insertErr?.message?.includes('greeting_type')) {
    // Column doesn't exist — insert without it
    const { data: fallbackRec, error: fallbackErr } = await supabase
      .from('greeting_recordings')
      .insert({ name, url, r2_key: r2Key, is_active: true })
      .select()
      .single()

    if (fallbackErr) throw fallbackErr
    return fallbackRec
  }

  if (insertErr) throw insertErr
  return recording
}

// GET - get current active greeting URL (optionally filtered by greeting_type)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const greetingType = searchParams.get('type') || 'main'

    // Try with greeting_type filter first
    const { data: activeRecording, error } = await supabase
      .from('greeting_recordings')
      .select('url')
      .eq('is_active', true)
      .eq('greeting_type', greetingType)
      .maybeSingle()

    if (error?.message?.includes('greeting_type')) {
      // Column doesn't exist — query without it
      const { data: fallback } = await supabase
        .from('greeting_recordings')
        .select('url')
        .eq('is_active', true)
        .maybeSingle()

      if (fallback?.url) return NextResponse.json({ url: fallback.url })
    } else if (activeRecording?.url) {
      return NextResponse.json({ url: activeRecording.url })
    }

    // Fall back to legacy settings key (only for main greeting)
    if (greetingType === 'main') {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'call_greeting_url')
        .maybeSingle()

      return NextResponse.json({ url: data?.value || null })
    }

    return NextResponse.json({ url: null })
  } catch {
    return NextResponse.json({ url: null })
  }
}

// POST - two modes:
// 1. FormData with 'file' — legacy upload through serverless function (small files only)
// 2. JSON with { url, r2Key, name, greeting_type } — metadata save after presigned URL upload
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Mode 2: JSON metadata save (presigned URL flow — no file in body)
    if (contentType.includes('application/json')) {
      const { url, r2Key, name, greeting_type } = await request.json()

      if (!url || !r2Key) {
        return NextResponse.json({ error: 'url and r2Key required' }, { status: 400 })
      }

      const recording = await saveRecording(
        name || 'Recorded Greeting',
        url,
        r2Key,
        greeting_type || 'main'
      )

      return NextResponse.json({ success: true, url, recording })
    }

    // Mode 1: FormData file upload (legacy — for small files under 4.5MB)
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string || 'Recorded Greeting'
    const greetingType = formData.get('greeting_type') as string || 'main'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/webm']
    const allowedExtensions = /\.(mp3|wav|ogg|webm)$/i
    if (!allowedTypes.includes(file.type) && !file.name.match(allowedExtensions)) {
      return NextResponse.json({ error: 'Invalid format. Use MP3, WAV, or OGG.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'wav'
    const key = `call-greetings/${timestamp}-greeting.${ext}`

    await S3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }))

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

    const recording = await saveRecording(name, publicUrl, key, greetingType)

    return NextResponse.json({ success: true, url: publicUrl, recording })
  } catch (err: any) {
    console.error('Greeting upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - deactivate greeting of a given type (revert to TTS)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const greetingType = searchParams.get('type') || 'main'

    // Try with greeting_type column
    const { error } = await supabase
      .from('greeting_recordings')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('greeting_type', greetingType)

    if (error?.message?.includes('greeting_type')) {
      // Column doesn't exist — deactivate all
      await supabase
        .from('greeting_recordings')
        .update({ is_active: false })
        .eq('is_active', true)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
