import { supabase } from '../../lib/supabase'
import CalendarView from './CalendarView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CalendarPage() {
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_time', { ascending: true })

  return <CalendarView initialEvents={events || []} />
}