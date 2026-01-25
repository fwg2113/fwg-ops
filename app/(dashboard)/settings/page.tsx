import { supabase } from '../../lib/supabase'
import SettingsView from './SettingsView'

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

  return (
    <SettingsView 
      initialCategories={categories || []} 
      initialMaterials={materials || []}
      initialBuckets={buckets || []}
    />
  )
}