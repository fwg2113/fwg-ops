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
        instructions,
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

  const { data: customerWorkflows } = await supabase
    .from('customer_workflow_templates')
    .select(`
      *,
      customer_workflow_steps (
        id,
        template_key,
        step_key,
        label,
        description,
        instructions,
        default_priority,
        sort_order,
        auto_complete_on_status,
        active
      )
    `)
    .order('sort_order', { ascending: true })

  // DTF Pricing Matrix
  const { data: dtfPricing } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', 'dtf')
    .single()

  // Embroidery Markup Matrix (separate qty breaks for markup %)
  const { data: embroideryMarkupPricing } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', 'embroidery_markup')
    .single()

  // Embroidery Fee Matrix (separate qty breaks for stitch fees)
  const { data: embroideryFeePricing } = await supabase
    .from('apparel_pricing_matrices')
    .select('*')
    .eq('decoration_type', 'embroidery_fee')
    .single()

  // Call greeting
  const { data: callGreeting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'call_greeting_url')
    .maybeSingle()

  // Greeting recordings library
  const { data: greetingRecordings } = await supabase
    .from('greeting_recordings')
    .select('*')
    .order('created_at', { ascending: false })

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
      initialCallGreetingUrl={callGreeting?.value || null}
      initialGreetingRecordings={greetingRecordings || []}
      initialTemplates={templates || []}
      initialTaskStatuses={taskStatuses || []}
      initialTaskPriorities={taskPriorities || []}
      initialAutomationSettings={automationSettings || []}
      initialVehicleCategories={vehicleCategories || []}
      initialProjectTypes={projectTypes || []}
      initialPricingMatrix={pricingMatrix || []}
      initialCustomerWorkflows={customerWorkflows || []}
      initialDtfPricing={dtfPricing}
      initialEmbroideryMarkupPricing={embroideryMarkupPricing}
      initialEmbroideryFeePricing={embroideryFeePricing}
    />
  )
}
