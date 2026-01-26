import { supabase } from '../../lib/supabase'
import SettingsView from './SettingsView'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
  
  const { data: materials } = await supabase
    .from('materials')
    .select('*')
    .order('label', { ascending: true })
  
  const { data: buckets } = await supabase
    .from('buckets')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: calendarSettings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'google_calendar_tokens')
    .single()

  const { data: callSettings } = await supabase
    .from('call_settings')
    .select('*')
    .order('ring_order', { ascending: true })

  const calendarConnected = !!calendarSettings?.value

  return (
    <SettingsView 
      initialCategories={categories || []} 
      initialMaterials={materials || []}
      initialBuckets={buckets || []}
      calendarConnected={calendarConnected}
      initialCallSettings={callSettings || []}
    />
  )
}
