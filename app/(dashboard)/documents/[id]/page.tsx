import { supabase } from '../../../lib/supabase'
import DocumentDetail from './DocumentDetail'

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  const { data: lineItems } = await supabase
    .from('line_items')
    .select('*')
    .eq('document_id', id)
    .order('sort_order', { ascending: true })

  if (!document) {
    return <div style={{ color: '#f1f5f9', padding: '40px' }}>Document not found</div>
  }

  return <DocumentDetail document={document} initialLineItems={lineItems || []} />
}