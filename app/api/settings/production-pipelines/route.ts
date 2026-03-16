import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

/**
 * GET /api/settings/production-pipelines
 * Fetch all pipeline configs ordered by category, track, sort_order
 */
export async function GET() {
  const { data, error } = await supabase
    .from('production_pipeline_configs')
    .select('*')
    .order('category_key')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}

/**
 * POST /api/settings/production-pipelines
 * CRUD operations for pipeline tasks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'add_task': {
        const { category_key, track, track_label, task_key, task_label, task_icon, sort_order } = body
        if (!category_key || !track || !task_key || !task_label) {
          return NextResponse.json({ error: 'category_key, track, task_key, and task_label are required' }, { status: 400 })
        }
        const { data, error } = await supabase
          .from('production_pipeline_configs')
          .insert({
            category_key,
            track,
            track_label: track_label || null,
            task_key: task_key.toLowerCase().replace(/\s+/g, '_'),
            task_label,
            task_icon: task_icon || '○',
            sort_order: sort_order || 0,
          })
          .select()
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, task: data })
      }

      case 'update_task': {
        const { id, task_label, task_icon, sort_order } = body
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        const updates: Record<string, any> = {}
        if (task_label !== undefined) updates.task_label = task_label
        if (task_icon !== undefined) updates.task_icon = task_icon
        if (sort_order !== undefined) updates.sort_order = sort_order
        if (Object.keys(updates).length === 0) {
          return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
        }
        const { error } = await supabase
          .from('production_pipeline_configs')
          .update(updates)
          .eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      case 'delete_task': {
        const { id } = body
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
        const { error } = await supabase
          .from('production_pipeline_configs')
          .delete()
          .eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      case 'reorder': {
        const { tasks } = body
        if (!Array.isArray(tasks)) return NextResponse.json({ error: 'tasks array is required' }, { status: 400 })
        for (const t of tasks) {
          await supabase
            .from('production_pipeline_configs')
            .update({ sort_order: t.sort_order })
            .eq('id', t.id)
        }
        return NextResponse.json({ success: true })
      }

      case 'update_track_label': {
        const { category_key, track, track_label } = body
        if (!category_key || !track) return NextResponse.json({ error: 'category_key and track are required' }, { status: 400 })
        const { error } = await supabase
          .from('production_pipeline_configs')
          .update({ track_label })
          .eq('category_key', category_key)
          .eq('track', track)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      case 'copy_from': {
        const { source_category_key, target_category_key } = body
        if (!source_category_key || !target_category_key) {
          return NextResponse.json({ error: 'source_category_key and target_category_key are required' }, { status: 400 })
        }
        // Fetch source rows
        const { data: sourceRows, error: srcErr } = await supabase
          .from('production_pipeline_configs')
          .select('*')
          .eq('category_key', source_category_key)
          .order('sort_order')
        if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
        if (!sourceRows || sourceRows.length === 0) {
          return NextResponse.json({ error: 'Source pipeline has no tasks' }, { status: 400 })
        }
        // Delete existing rows for target
        await supabase
          .from('production_pipeline_configs')
          .delete()
          .eq('category_key', target_category_key)
        // Insert copies with new category_key
        const copies = sourceRows.map(r => ({
          category_key: target_category_key,
          track: r.track,
          track_label: r.track_label,
          task_key: r.task_key,
          task_label: r.task_label,
          task_icon: r.task_icon,
          sort_order: r.sort_order,
        }))
        const { error: insertErr } = await supabase
          .from('production_pipeline_configs')
          .insert(copies)
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
        return NextResponse.json({ success: true, copied: copies.length })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Production pipelines API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
