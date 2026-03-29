export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import WasteReporter from './WasteReporter'

export default async function WasteReporterPage() {
  const [materialsRes, reportsRes, teamRes] = await Promise.all([
    supabase.from('materials_v2').select('id, name, tab_category, material_subtype, cost_per_roll, width_inches, length_yards, waste_unit').eq('active', true).order('name'),
    supabase.from('waste_reports').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('nih_team_members').select('id, name').eq('is_active', true).order('name'),
  ])

  return (
    <WasteReporter
      materials={materialsRes.data || []}
      initialReports={reportsRes.data || []}
      teamMembers={teamRes.data || []}
    />
  )
}
