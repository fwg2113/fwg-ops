import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { supabase } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getAuth() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set')
  }
  const credentials = JSON.parse(serviceAccountJson)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const teamMemberId = formData.get('teamMemberId') as string
    const file = formData.get('file') as File | null

    if (!teamMemberId || !file) {
      return NextResponse.json({ error: 'Missing teamMemberId or file' }, { status: 400 })
    }

    const folderId = process.env.NIH_CONTENT_DRIVE_FOLDER_ID
    if (!folderId) {
      return NextResponse.json({ error: 'NIH_CONTENT_DRIVE_FOLDER_ID not configured' }, { status: 500 })
    }

    // Look up team member
    const { data: member, error: memberErr } = await supabase
      .from('nih_team_members')
      .select('id, name, total_points')
      .eq('id', teamMemberId)
      .single()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    // Determine file type and points
    const mimeType = file.type || 'application/octet-stream'
    const fileType = mimeType.startsWith('video/') ? 'video' : 'photo'
    const points = fileType === 'video' ? 3 : 1

    // Upload to Google Drive
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    const buffer = Buffer.from(await file.arrayBuffer())
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)

    // Sanitize filename — remove characters that break Drive API
    const safeName = (file.name || `content-${Date.now()}.${fileType === 'video' ? 'mp4' : 'jpg'}`)
      .replace(/[^\w\s.\-()]/g, '_')

    const driveFile = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: [folderId],
        driveId: folderId,
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    const driveFileId = driveFile.data.id!
    const driveFileUrl = `https://drive.google.com/file/d/${driveFileId}/view`

    // Insert content upload record
    await supabase.from('nih_content_uploads').insert({
      uploaded_by_id: member.id,
      uploaded_by_name: member.name,
      file_name: file.name || `content-${Date.now()}`,
      mime_type: mimeType,
      file_type: fileType,
      points_awarded: points,
      drive_file_id: driveFileId,
      drive_file_url: driveFileUrl,
    })

    // Update team member points
    const newTotal = (member.total_points || 0) + points
    await supabase
      .from('nih_team_members')
      .update({ total_points: newTotal })
      .eq('id', member.id)

    return NextResponse.json({
      success: true,
      fileType,
      pointsAwarded: points,
      newTotalPoints: newTotal,
      memberName: member.name,
    })
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gErr = err as any
    const detail = gErr?.errors?.[0]?.message || gErr?.message || 'Content upload failed'
    console.error('[content-upload] error:', detail, JSON.stringify(gErr?.errors || gErr?.message || err))
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
