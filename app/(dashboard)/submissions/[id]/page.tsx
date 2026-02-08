import { supabase } from '../../../lib/supabase'
import SubmissionDetail from './SubmissionDetail'
import { notFound } from 'next/navigation'

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !submission) {
    notFound()
  }

  return <SubmissionDetail submission={submission} />
}
