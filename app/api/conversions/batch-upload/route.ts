import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { uploadClickConversion } from '@/app/lib/googleAdsConversion'

// ─── Batch Offline Conversion Upload ───
// Queries submissions with a gclid that haven't been uploaded yet,
// sends each to Google Ads as an offline click conversion,
// and marks them as uploaded in Supabase.
//
// Call manually: POST /api/conversions/batch-upload

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST() {
  try {
    // 1. Fetch pending conversions
    const { data: leads, error: fetchError } = await supabase
      .from('submissions')
      .select('id, gclid, created_at')
      .not('gclid', 'is', null)
      .or('conversion_uploaded.is.null,conversion_uploaded.eq.false')
      .order('created_at', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: 'No pending conversions', uploaded: 0, failed: 0 })
    }

    // 2. Upload each conversion
    const results: { id: string; gclid: string; ok: boolean; error?: string }[] = []

    for (const lead of leads) {
      const result = await uploadClickConversion(
        lead.gclid,
        new Date(lead.created_at),
        0, // default value — no job value available at submission time
      )

      if (result.ok) {
        // 3. Mark as uploaded
        await supabase
          .from('submissions')
          .update({ conversion_uploaded: true })
          .eq('id', lead.id)

        results.push({ id: lead.id, gclid: lead.gclid, ok: true })
      } else {
        results.push({ id: lead.id, gclid: lead.gclid, ok: false, error: result.error })
      }
    }

    const uploaded = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length

    return NextResponse.json({
      message: `Processed ${leads.length} conversions: ${uploaded} uploaded, ${failed} failed`,
      uploaded,
      failed,
      results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Batch conversion upload error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
