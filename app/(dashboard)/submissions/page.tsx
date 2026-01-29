import { supabase } from '../../lib/supabase'
import LeadPipeline from './LeadPipeline'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SubmissionsPage() {
  // Fetch submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch quotes
  const { data: quotes } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'quote')
    .order('created_at', { ascending: false })

  // Fetch invoices
  const { data: invoices } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'invoice')
    .order('created_at', { ascending: false })

  return (
    <LeadPipeline 
      submissions={submissions || []} 
      quotes={quotes || []} 
      invoices={invoices || []} 
    />
  )
}
