import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const BUCKET = 'notification-sounds'
const SETTINGS_KEY = 'custom_notification_sounds'

// GET - list custom sounds
export async function GET() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const sounds = data?.value
      ? (typeof data.value === 'string' ? JSON.parse(data.value) : data.value)
      : []

    return NextResponse.json({ sounds })
  } catch {
    return NextResponse.json({ sounds: [] })
  }
}

// POST - upload a new custom sound
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const label = (formData.get('label') as string) || file.name.replace(/\.[^.]+$/, '')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp4', 'audio/aac']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a|aac)$/i)) {
      return NextResponse.json({ error: 'Invalid file type. Use MP3, WAV, OGG, M4A, or AAC.' }, { status: 400 })
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 })
    }

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true })
    }

    // Upload file
    const fileId = `sound_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const ext = file.name.split('.').pop() || 'mp3'
    const filePath = `${fileId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || 'audio/mpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    const url = urlData.publicUrl

    // Save metadata to settings
    const { data: existing } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const currentSounds = existing?.value
      ? (typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value)
      : []

    const newSound = { id: fileId, label, url, filePath, uploadedAt: new Date().toISOString() }
    const updatedSounds = [...currentSounds, newSound]

    await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(updatedSounds),
      }, { onConflict: 'key' })

    return NextResponse.json({ success: true, sound: newSound })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - remove a custom sound
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    // Get current sounds
    const { data: existing } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const currentSounds = existing?.value
      ? (typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value)
      : []

    const sound = currentSounds.find((s: any) => s.id === id)
    if (sound?.filePath) {
      await supabase.storage.from(BUCKET).remove([sound.filePath])
    }

    const updatedSounds = currentSounds.filter((s: any) => s.id !== id)

    await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(updatedSounds),
      }, { onConflict: 'key' })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
