import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// POST /api/settings/manage-template
// CRUD operations for production and customer workflow templates
//
// Body: {
//   action: 'create' | 'update' | 'delete',
//   type: 'production' | 'customer',
//   id?: string,              // required for update/delete
//   template_key?: string,    // required for create
//   category_key?: string,    // required for create
//   label?: string,           // required for create, optional for update
//   description?: string,     // optional
// }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, type, id, template_key, category_key, label, description } = body

    if (!action || !type) {
      return NextResponse.json({ error: 'action and type required' }, { status: 400 })
    }

    const table = type === 'production' ? 'project_templates' : 'customer_workflow_templates'
    const categoryColumn = type === 'production' ? 'template_key' : 'customer_template_key'

    // ---- CREATE ----
    if (action === 'create') {
      if (!template_key || !label) {
        return NextResponse.json({ error: 'template_key and label required' }, { status: 400 })
      }

      const cleanKey = template_key.trim().toUpperCase().replace(/\s+/g, '_')

      // Create the template
      const { data: newTemplate, error: createErr } = await supabase
        .from(table)
        .insert({
          template_key: cleanKey,
          category_key: category_key || cleanKey,
          label: label.trim(),
          description: description?.trim() || null,
          active: true,
          sort_order: 100
        })
        .select('*')
        .single()

      if (createErr) {
        if (createErr.message.includes('duplicate')) {
          return NextResponse.json({ error: 'A template with this key already exists' }, { status: 400 })
        }
        throw createErr
      }

      // If category_key was provided, link it to this new template
      if (category_key) {
        await supabase
          .from('categories')
          .update({ [categoryColumn]: cleanKey })
          .eq('category_key', category_key)
      }

      // Return with empty steps/tasks array
      const result = type === 'production'
        ? { ...newTemplate, template_tasks: [] }
        : { ...newTemplate, customer_workflow_steps: [] }

      return NextResponse.json({ success: true, template: result })
    }

    // ---- UPDATE (rename) ----
    if (action === 'update') {
      if (!id) {
        return NextResponse.json({ error: 'id required for update' }, { status: 400 })
      }

      const updates: any = {}
      if (label !== undefined) updates.label = label.trim()
      if (description !== undefined) updates.description = description?.trim() || null

      const { data: updated, error: updateErr } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

      if (updateErr) throw updateErr

      return NextResponse.json({ success: true, template: updated })
    }

    // ---- DELETE ----
    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ error: 'id required for delete' }, { status: 400 })
      }

      // First get the template to know its key
      const { data: tmpl, error: fetchErr } = await supabase
        .from(table)
        .select('template_key')
        .eq('id', id)
        .single()

      if (fetchErr) throw fetchErr

      // Check if any categories still reference this template
      const { data: linkedCats } = await supabase
        .from('categories')
        .select('category_key')
        .eq(categoryColumn, tmpl.template_key)

      if (linkedCats && linkedCats.length > 0) {
        return NextResponse.json({
          error: `Cannot delete: ${linkedCats.length} categories still use this template. Unlink them first.`
        }, { status: 400 })
      }

      // Delete steps/tasks first (FK constraint)
      if (type === 'production') {
        await supabase.from('template_tasks').delete().eq('template_key', tmpl.template_key)
      } else {
        await supabase.from('customer_workflow_steps').delete().eq('template_key', tmpl.template_key)
      }

      // Delete the template
      const { error: deleteErr } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (deleteErr) throw deleteErr

      return NextResponse.json({ success: true, deleted: tmpl.template_key })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('Manage template error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
