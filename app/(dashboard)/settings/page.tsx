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

  const { data: templates } = await supabase
    .from('project_templates')
    .select(`
      *,
      template_tasks (
        id,
        task_key,
        label,
        default_priority,
        sort_order,
        active
      )
    `)
    .order('sort_order', { ascending: true })

  const { data: taskStatuses } = await supabase
    .from('task_statuses')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: taskPriorities } = await supabase
    .from('task_priorities')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: automationSettings } = await supabase
    .from('automation_settings')
    .select('*')
    .order('automation_key', { ascending: true })

  const { data: gmailSettings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'google_gmail_tokens')
    .single()

  // Estimator config
  const { data: vehicleCategories } = await supabase
    .from('estimator_vehicle_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: projectTypes } = await supabase
    .from('estimator_project_types')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: pricingMatrix } = await supabase
    .from('estimator_pricing')
    .select('*')
    .order('category_key')

  const calendarConnected = !!calendarSettings?.value
  const gmailConnected = !!gmailSettings?.value

  return (
    <SettingsView
      initialCategories={categories || []}
      initialMaterials={materials || []}
      initialBuckets={buckets || []}
      calendarConnected={calendarConnected}
      gmailConnected={gmailConnected}
      initialCallSettings={callSettings || []}
      initialTemplates={templates || []}
      initialTaskStatuses={taskStatuses || []}
      initialTaskPriorities={taskPriorities || []}
      initialAutomationSettings={automationSettings || []}
      initialVehicleCategories={vehicleCategories || []}
      initialProjectTypes={projectTypes || []}
      initialPricingMatrix={pricingMatrix || []}
    />
  )
}
