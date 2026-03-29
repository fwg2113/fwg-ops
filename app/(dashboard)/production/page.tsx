export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@supabase/supabase-js'
import ProductionList from './ProductionList'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export default async function ProductionPage() {
  try {
    // Fetch active categories to determine groupings
    const { data: dbCategories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (catError) {
      console.error('Failed to fetch categories:', catError)
    }

    const categoriesData = dbCategories || []
    const nonApparelCatKeys = categoriesData.filter(c => c.parent_category !== 'APPAREL').map(c => c.category_key)

    // Fetch documents that are paid or in production
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .or('status.eq.paid,in_production.eq.true')
      .order('created_at', { ascending: false })

    if (docsError) {
      console.error('Failed to fetch documents:', docsError)
    }

    const docIds = (docs || []).map(d => d.id)

    // Fetch all line items for those documents
    let lineItems: any[] = []
    if (docIds.length > 0) {
      const { data, error: liError } = await supabase
        .from('line_items')
        .select('*')
        .in('document_id', docIds)
      if (liError) console.error('Failed to fetch line items:', liError)
      lineItems = data || []
    }

    // Fetch calendar events linked to these documents
    let calendarEvents: any[] = []
    if (docIds.length > 0) {
      const { data, error: calError } = await supabase
        .from('calendar_events')
        .select('*')
        .in('document_id', docIds)
      if (calError) console.error('Failed to fetch calendar events:', calError)
      calendarEvents = data || []
    }

    const calendarByDocId: Record<string, any[]> = {}
    for (const ev of calendarEvents) {
      if (!calendarByDocId[ev.document_id]) calendarByDocId[ev.document_id] = []
      calendarByDocId[ev.document_id].push(ev)
    }

    // Fetch production pipeline configs from DB
    const { data: pipelineConfigs, error: pipeError } = await supabase
      .from('production_pipeline_configs')
      .select('*')
      .order('category_key')
      .order('sort_order')

    if (pipeError) console.error('Failed to fetch pipeline configs:', pipeError)

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
  } catch (error) {
    console.error('Production page error:', error)
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
        <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Production couldn&apos;t load
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          There was a problem connecting to the database. Try refreshing the page.
        </p>
        <a href="/production" style={{ padding: '10px 24px', borderRadius: 8, background: '#a855f7', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Refresh
        </a>
      </div>
    )
  }
}
