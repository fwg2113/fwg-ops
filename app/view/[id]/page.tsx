import { supabase } from '../../lib/supabase'
import CustomerView from './CustomerView'

export default async function CustomerViewPage({ params }: { params: Promise<{ id: string }> }) {
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
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#111', 
        color: '#f1f5f9', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        Document not found
      </div>
    )
  }

  // Mark as viewed
  if (document.status === 'sent') {
    await supabase
      .from('documents')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', id)
  }

  return <CustomerView document={document} lineItems={lineItems || []} />
}
