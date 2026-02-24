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

// GET - list all greeting recordings
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('greeting_recordings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ recordings: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - upload a new greeting recording
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string || 'Untitled Greeting'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate audio type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg']
    const allowedExtensions = /\.(mp3|wav|ogg)$/i
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

    const { data, error } = await supabase
      .from('greeting_recordings')
      .insert({
        name,
        url: publicUrl,
        r2_key: key,
        is_active: false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Save failed: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, recording: data })
  } catch (err: any) {
    console.error('Greeting recording upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT - set a recording as active (or rename it)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, is_active, name } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing recording id' }, { status: 400 })
    }

    // If setting active, deactivate all others first
    if (is_active) {
      await supabase
        .from('greeting_recordings')
        .update({ is_active: false })
        .neq('id', id)
    }

    const updates: Record<string, any> = {}
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (typeof name === 'string') updates.name = name

    const { data, error } = await supabase
      .from('greeting_recordings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, recording: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - remove a recording
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing recording id' }, { status: 400 })
    }

    // Get the recording to find the R2 key
    const { data: recording } = await supabase
      .from('greeting_recordings')
      .select('r2_key')
      .eq('id', id)
      .single()

    if (recording?.r2_key) {
      try {
        await S3.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: recording.r2_key,
        }))
      } catch (e) {
        console.error('Failed to delete from R2:', e)
      }
    }

    const { error } = await supabase
      .from('greeting_recordings')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
