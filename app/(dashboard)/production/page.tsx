export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@supabase/supabase-js'
import ProductionList from './ProductionList'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export default async function ProductionPage() {
  // Fetch active categories to determine groupings
  const { data: dbCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const categoriesData = dbCategories || []
  const apparelCatKeys = categoriesData.filter(c => c.parent_category === 'APPAREL').map(c => c.category_key)
  const nonApparelCatKeys = categoriesData.filter(c => c.parent_category !== 'APPAREL').map(c => c.category_key)

  // Fetch documents that are paid or in production
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .or('status.eq.paid,in_production.eq.true')
    .order('created_at', { ascending: false })

  const docIds = (docs || []).map(d => d.id)

  // Fetch all line items for those documents
  let lineItems: any[] = []
  if (docIds.length > 0) {
    const { data } = await supabase
      .from('line_items')
      .select('*')
      .in('document_id', docIds)
    lineItems = data || []
  }

  // Fetch calendar events linked to these documents
  let calendarEvents: any[] = []
  if (docIds.length > 0) {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .in('document_id', docIds)
    calendarEvents = data || []
  }

  const calendarByDocId: Record<string, any[]> = {}
  for (const ev of calendarEvents) {
    if (!calendarByDocId[ev.document_id]) calendarByDocId[ev.document_id] = []
    calendarByDocId[ev.document_id].push(ev)
  }

  // Fetch production pipeline configs from DB
  const { data: pipelineConfigs } = await supabase
    .from('production_pipeline_configs')
    .select('*')
    .order('category_key')
    .order('sort_order')

  // Only include documents that have at least one non-apparel line item
  const documents = (docs || [])
    .map(d => ({
      ...d,
      line_items: lineItems.filter(li => li.document_id === d.id),
      calendar_events: calendarByDocId[d.id] || [],
    }))
    .filter(d =>
      d.line_items.some((li: any) =>
        nonApparelCatKeys.includes(li.category)
      )
    )

  return (
    <ProductionList
      documents={documents}
      pipelineConfigs={pipelineConfigs || []}
      categoriesData={categoriesData}
    />
  )
}
