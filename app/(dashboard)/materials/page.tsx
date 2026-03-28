export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import MaterialsList from './MaterialsList'

export default async function MaterialsPage() {
  const [materialsRes, categoriesRes, lineTypesRes, vendorsRes, materialVendorsRes] = await Promise.all([
    supabase.from('materials_v2').select('*').order('name'),
    supabase.from('categories').select('category_key, label').eq('active', true).not('category_key', 'in', '("APPAREL","DTF_TRANSFER","DTF","EMBROIDERY","SCREEN_PRINT")').order('sort_order'),
    supabase.from('line_item_types').select('type_key, label, category_key').not('category_key', 'in', '("APPAREL","DTF_TRANSFER","DTF","EMBROIDERY","SCREEN_PRINT")').order('label'),
    supabase.from('vendors').select('*').eq('active', true).order('name'),
    supabase.from('material_vendors').select('*, vendors(*)').order('created_at'),
  ])

  return (
    <MaterialsList
      initialMaterials={materialsRes.data || []}
      categories={categoriesRes.data || []}
      lineItemTypes={lineTypesRes.data || []}
      vendors={vendorsRes.data || []}
      initialMaterialVendors={materialVendorsRes.data || []}
    />
  )
}
