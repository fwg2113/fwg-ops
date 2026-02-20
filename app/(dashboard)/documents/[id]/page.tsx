import { supabase } from '../../../lib/supabase'
import DocumentDetail from './DocumentDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  const { data: lineItemsRaw } = await supabase
    .from('line_items')
    .select('*')
    .eq('document_id', id)
    .order('sort_order', { ascending: true })

  // Parse attachments if needed
  const lineItems = (lineItemsRaw || []).map(item => ({
    ...item,
    attachments: item.attachments 
      ? (typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments) 
      : []
  }))

  const { data: customers } = await supabase
    .from('customers')
    .select('id, display_name, first_name, last_name, email, phone, company, emb_thread_colors, emb_drive_folder_url')
    .order('display_name', { ascending: true })

  // Fetch quote builder config from Supabase
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const { data: packages } = await supabase
    .from('packages')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const { data: lineItemTypes } = await supabase
    .from('line_item_types')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const { data: feeTypes } = await supabase
    .from('fee_types')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false })

  // Fetch DTF pricing matrix
  const { data: dtfPricingMatrix } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', 'dtf')
    .single()

  // Fetch Embroidery pricing matrices (separate markup and fee)
  const { data: embroideryMarkupMatrix } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', 'embroidery_markup')
    .single()

  const { data: embroideryFeeMatrix } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', 'embroidery_fee')
    .single()

  if (!document) {
    return <div style={{ color: '#f1f5f9', padding: '40px' }}>Document not found</div>
  }

  return (
    <DocumentDetail
      document={document}
      initialLineItems={lineItems || []}
      customers={customers || []}
      categories={categories || []}
      packages={packages || []}
      lineItemTypes={lineItemTypes || []}
      feeTypes={feeTypes || []}
      payments={payments || []}
      dtfPricingMatrix={dtfPricingMatrix || null}
      embroideryMarkupMatrix={embroideryMarkupMatrix || null}
      embroideryFeeMatrix={embroideryFeeMatrix || null}
    />
  )
}