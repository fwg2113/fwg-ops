import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabase } from '../../../lib/supabase'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// GET - get current active greeting URL (optionally filtered by greeting_type)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const greetingType = searchParams.get('type') || 'main'

    // Check greeting_recordings table for active recording of this type
    const { data: activeRecording } = await supabase
      .from('greeting_recordings')
      .select('url')
      .eq('is_active', true)
      .eq('greeting_type', greetingType)
      .maybeSingle()

    if (activeRecording?.url) {
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

// POST - upload a new greeting audio and save to recording library
// Accepts optional 'greeting_type' form field: 'main' (default) or a category key
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string || 'Recorded Greeting'
    const greetingType = formData.get('greeting_type') as string || 'main'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate audio type - Twilio supports WAV, MP3, OGG
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg']
    const allowedExtensions = /\.(mp3|wav|ogg)$/i
    if (!allowedTypes.includes(file.type) && !file.name.match(allowedExtensions)) {
      return NextResponse.json({ error: 'Invalid format. Use MP3, WAV, or OGG (Twilio compatible).' }, { status: 400 })
    }

    // Max 5MB
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

    // Deactivate existing recordings of the same type
    await supabase
      .from('greeting_recordings')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('greeting_type', greetingType)

    // Save to greeting_recordings library and set as active
    const { data: recording, error: recError } = await supabase
      .from('greeting_recordings')
      .insert({
        name,
        url: publicUrl,
        r2_key: key,
        is_active: true,
        greeting_type: greetingType,
      })
      .select()
      .single()

    if (recError) {
      return NextResponse.json({ error: 'Save failed: ' + recError.message }, { status: 500 })
    }

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

    // Deactivate recordings of this type (don't delete them - they stay in the library)
    await supabase
      .from('greeting_recordings')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('greeting_type', greetingType)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
