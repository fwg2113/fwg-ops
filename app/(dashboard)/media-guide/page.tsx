export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import MediaGuide from './MediaGuide'

export default async function MediaGuidePage() {
  const [materialsRes, categoriesRes, printersRes] = await Promise.all([
    supabase.from('materials_v2').select('*').eq('active', true).order('name'),
    supabase.from('categories').select('category_key, label').eq('active', true).not('category_key', 'in', '("APPAREL","DTF_TRANSFER","DTF","EMBROIDERY","SCREEN_PRINT")').order('sort_order'),
    supabase.from('printers').select('*').eq('active', true).order('name'),
  ])

  return (
    <MediaGuide
      materials={materialsRes.data || []}
      categories={categoriesRes.data || []}
      printers={printersRes.data || []}
    />
  )
}
