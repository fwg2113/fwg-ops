import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabase } from '../../../lib/supabase'

const SETTINGS_KEY = 'call_greeting_url'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// GET - get current greeting URL
export async function GET() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    return NextResponse.json({ url: data?.value || null })
  } catch {
    return NextResponse.json({ url: null })
  }
}

// POST - upload a new greeting audio
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

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

    // Delete old greeting from R2 if exists
    const { data: existing } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    if (existing?.value) {
      try {
        const oldUrl = typeof existing.value === 'string' ? existing.value : ''
        const oldKey = oldUrl.split('/').slice(-2).join('/')
        if (oldKey.startsWith('call-greetings/')) {
          await S3.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: oldKey,
          }))
        }
      } catch (e) {
        console.error('Failed to delete old greeting:', e)
      }
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

    // Save URL to settings
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: publicUrl,
      }, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ error: 'Save failed: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err: any) {
    console.error('Greeting upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - remove greeting and revert to TTS
export async function DELETE() {
  try {
    // Get current URL to delete from R2
    const { data: existing } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    if (existing?.value) {
      try {
        const oldUrl = typeof existing.value === 'string' ? existing.value : ''
        const oldKey = oldUrl.split('/').slice(-2).join('/')
        if (oldKey.startsWith('call-greetings/')) {
          await S3.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: oldKey,
          }))
        }
      } catch (e) {
        console.error('Failed to delete from R2:', e)
      }
    }

    // Remove from settings
    await supabase
      .from('settings')
      .delete()
      .eq('key', SETTINGS_KEY)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
