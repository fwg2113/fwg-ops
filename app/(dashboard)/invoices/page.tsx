import { supabase } from '../../lib/supabase'
import DocumentList from '../documents/DocumentList'

// Force dynamic rendering to prevent caching deleted documents
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InvoicesPage() {
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'invoice')
    .neq('status', 'archived')
    .not('bucket', 'in', '("ARCHIVE_WON","ARCHIVE_LOST","COLD")')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: customers } = await supabase
    .from('customers')
    .select('id, display_name, first_name, last_name, email, phone, company')
    .order('display_name', { ascending: true })

  return <DocumentList initialDocuments={documents || []} customers={customers || []} docType="invoice" />
}
