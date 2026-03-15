import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// One-time backfill: copy all document attachments to their customer's project_files_json
// Deduplicates by URL so running multiple times is safe
export async function POST() {
  try {
    // Fetch all documents that have attachments and a customer_id
    const { data: docs, error: docErr } = await supabase
      .from('documents')
      .select('id, customer_id, attachments')
      .not('customer_id', 'is', null)
      .not('attachments', 'is', null)

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 })
    }

    // Group attachments by customer_id
    const customerFiles: Record<string, any[]> = {}
    for (const doc of docs || []) {
      if (!doc.customer_id || !doc.attachments || !Array.isArray(doc.attachments)) continue
      if (!customerFiles[doc.customer_id]) customerFiles[doc.customer_id] = []
      for (const att of doc.attachments) {
        if (att.url) customerFiles[doc.customer_id].push(att)
      }
    }

    let customersUpdated = 0
    let filesAdded = 0

    // For each customer, merge document files into their project_files_json
    for (const [customerId, docFiles] of Object.entries(customerFiles)) {
      const { data: customer } = await supabase
        .from('customers')
        .select('project_files_json')
        .eq('id', customerId)
        .single()

      if (!customer) continue

      const existing: any[] = customer.project_files_json
        ? JSON.parse(customer.project_files_json)
        : []
      const existingUrls = new Set(existing.map(f => f.url))

      const toAdd = docFiles.filter(f => !existingUrls.has(f.url))
      if (toAdd.length === 0) continue

      const updated = [...existing, ...toAdd]
      await supabase
        .from('customers')
        .update({ project_files_json: JSON.stringify(updated) })
        .eq('id', customerId)

      customersUpdated++
      filesAdded += toAdd.length
    }

    return NextResponse.json({
      success: true,
      customersUpdated,
      filesAdded,
      totalCustomersWithFiles: Object.keys(customerFiles).length,
    })
  } catch (err: any) {
    console.error('[backfill-customer-files] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
