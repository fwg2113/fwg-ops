import { supabase } from '../../lib/supabase'
import CustomerDocumentView from './CustomerDocumentView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CustomerViewPage({ params }: { params: Promise<{ id: string }> }) {
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

  const lineItems = (lineItemsRaw || []).map((item: any) => ({
    ...item,
    attachments: item.attachments 
      ? (typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments) 
      : []
  }))

  if (!document) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f9fa',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '24px', marginBottom: '8px' }}>Document Not Found</h1>
          <p style={{ color: '#6b7280' }}>This document may have been removed or the link is invalid.</p>
        </div>
      </div>
    )
  }

  return (
    <CustomerDocumentView 
      document={document} 
      lineItems={lineItems} 
    />
  )
}