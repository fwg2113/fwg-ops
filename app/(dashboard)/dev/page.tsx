export const dynamic = 'force-dynamic'

import { supabase } from '@/app/lib/supabase'
import DevRequestsView from './DevRequestsView'

export default async function DevPage() {
  const { data: requests } = await supabase
    .from('dev_requests')
    .select('*')
    .order('created_at', { ascending: false })

  return <DevRequestsView initialRequests={requests || []} />
}
