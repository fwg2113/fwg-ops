import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAllTaskKeysWithDb, type DbPipelineRow } from '../../../lib/production/checklist-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

/**
 * POST /api/line-items/production-checklist
 *
 * Toggle a production checklist task on a line item.
 * Body: { line_item_id: string, task_key: string, done: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const { line_item_id, task_key, done, label, ad_hoc, track, position } = await req.json()

    if (!line_item_id || !task_key || typeof done !== 'boolean') {
      return NextResponse.json(
        { error: 'line_item_id, task_key, and done (boolean) are required' },
        { status: 400 }
      )
    }

    // Fetch current line item to get category, line_type + existing checklist
    const { data: lineItem, error: fetchError } = await supabase
      .from('line_items')
      .select('category, line_type, production_checklist')
      .eq('id', line_item_id)
      .single()

    if (fetchError || !lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    // Fetch DB pipeline configs for validation (check both category and line_type)
    const keysToCheck = [lineItem.category, lineItem.line_type].filter(Boolean)
    const { data: dbConfigs } = await supabase
      .from('production_pipeline_configs')
      .select('*')
      .in('category_key', keysToCheck)

    // Skip validation for ad-hoc/custom tasks (they start with 'custom_')
    if (!ad_hoc && !task_key.startsWith('custom_')) {
      const validKeys = getAllTaskKeysWithDb(lineItem.category, (dbConfigs || []) as DbPipelineRow[], lineItem.line_type)
      if (!validKeys.includes(task_key)) {
        return NextResponse.json(
          { error: `Invalid task_key "${task_key}" for category "${lineItem.category}"` },
          { status: 400 }
        )
      }
    }

    // Merge the update into the existing checklist
    const checklist = lineItem.production_checklist || {}
    const entry: Record<string, any> = done
      ? { done: true, at: new Date().toISOString() }
      : { done: false }
    if (label) entry.label = label
    if (track) entry.track = track
    if (position !== undefined) entry.position = position
    if (ad_hoc) entry.ad_hoc = true
    checklist[task_key] = entry

    // Save
    const { error: updateError } = await supabase
      .from('line_items')
      .update({ production_checklist: checklist })
      .eq('id', line_item_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, production_checklist: checklist })
  } catch (error) {
    console.error('Production checklist update error:', error)
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 })
  }
}
