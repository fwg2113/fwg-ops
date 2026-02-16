export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import ArchiveView from './ArchiveView'

export default async function ArchivePage() {
  // Completed projects (ARCHIVE_WON)
  const { data: completedDocs } = await supabase
    .from('documents')
    .select('id, doc_number, doc_type, status, customer_name, vehicle_description, project_description, category, total, created_at, paid_at, bucket, pre_archive_status, pre_archive_bucket')
    .eq('bucket', 'ARCHIVE_WON')
    .order('created_at', { ascending: false })

  // Cold leads (COLD bucket) and Lost projects (ARCHIVE_LOST)
  const { data: coldDocs } = await supabase
    .from('documents')
    .select('id, doc_number, doc_type, status, customer_name, vehicle_description, project_description, category, total, created_at, bucket, pre_archive_status, pre_archive_bucket')
    .in('bucket', ['COLD', 'ARCHIVE_LOST'])
    .order('created_at', { ascending: false })

  // Archived submissions
  const { data: archivedSubs } = await supabase
    .from('submissions')
    .select('id, customer_name, vehicle_year, vehicle_make, vehicle_model, project_type, price_range_max, created_at, status, pre_archive_status')
    .in('status', ['archived', 'lost'])
    .order('created_at', { ascending: false })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <ArchiveView
        completedDocs={completedDocs || []}
        coldDocs={coldDocs || []}
        archivedSubs={archivedSubs || []}
      />
    </div>
  )
}
