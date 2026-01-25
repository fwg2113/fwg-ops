import { supabase } from '../../lib/supabase'
import SubmissionList from './SubmissionList'

export default async function SubmissionsPage() {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const { count } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })

  return <SubmissionList initialSubmissions={submissions || []} totalCount={count || 0} />
}
