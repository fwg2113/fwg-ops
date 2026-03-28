export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import BladeGuide from './BladeGuide'

export default async function BladeGuidePage() {
  const [bladesRes, materialsRes, printersRes] = await Promise.all([
    supabase.from('blades').select('*').order('cutter').order('sort_order').order('color'),
    supabase.from('materials_v2').select('*').eq('active', true).order('name'),
    supabase.from('printers').select('*').eq('active', true).order('name'),
  ])

  return (
    <BladeGuide
      initialBlades={bladesRes.data || []}
      materials={materialsRes.data || []}
      printers={printersRes.data || []}
    />
  )
}
