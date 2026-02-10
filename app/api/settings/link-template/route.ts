import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// POST /api/settings/link-template
// Links or unlinks a category to/from a template.
//
// Body: {
//   categoryKey: string,         // The category to update
//   type: 'production' | 'customer',  // Which template system
//   targetTemplateKey: string | null   // null = unlink (revert to own template)
// }

export async function POST(request: Request) {
  try {
    const { categoryKey, type, targetTemplateKey } = await request.json()

    if (!categoryKey || !type) {
      return NextResponse.json({ error: 'categoryKey and type required' }, { status: 400 })
    }

    const column = type === 'production' ? 'template_key' : 'customer_template_key'

    if (targetTemplateKey === null) {
      // Unlink: revert to the category's own default template key
      const ownTemplateKey = type === 'production'
        ? categoryKey  // production templates use category_key as template_key
        : `${categoryKey}_CUSTOMER`

      const { error } = await supabase
        .from('categories')
        .update({ [column]: ownTemplateKey })
        .eq('category_key', categoryKey)

      if (error) throw error

      return NextResponse.json({ success: true, action: 'unlinked', newTemplateKey: ownTemplateKey })
    }

    // Link: point this category to another template
    const { error } = await supabase
      .from('categories')
      .update({ [column]: targetTemplateKey })
      .eq('category_key', categoryKey)

    if (error) throw error

    // For customer workflows, also migrate existing TODO actions to the new template
    if (type === 'customer') {
      // Find documents with this category that have customer_actions
      const { data: docs } = await supabase
        .from('documents')
        .select('id')
        .eq('category', categoryKey)
        .not('status', 'eq', 'archived')

      if (docs && docs.length > 0) {
        const docIds = docs.map(d => d.id)
        // Update template_key on existing TODO actions
        await supabase
          .from('customer_actions')
          .update({ template_key: targetTemplateKey })
          .in('document_id', docIds)
          .eq('status', 'TODO')
      }
    }

    return NextResponse.json({ success: true, action: 'linked', targetTemplateKey })
  } catch (err: any) {
    console.error('Link template error:', err)
    return NextResponse.json({ error: err.message || 'Failed to link template' }, { status: 500 })
  }
}
