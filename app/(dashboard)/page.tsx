export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@supabase/supabase-js'
import DailyPlan from './daily-plan/DailyPlan'
import { spawnRecurringForToday, todayLocalISO, addDaysISO } from '../lib/dailyPlan'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export default async function DailyPlanPage() {
  const supabase = svc()

  // 1. Spawn today's recurring tasks if not already spawned
  await spawnRecurringForToday(supabase).catch(err => console.error('Recurring spawn error:', err))

  // 2. Fetch all open daily tasks (not done) + done-today
  const today = todayLocalISO()
  const tomorrow = addDaysISO(today, 1)

  const { data: openTasks } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('status', 'TODO')
    .order('sort_order', { ascending: true })

  const { data: doneToday } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('status', 'DONE')
    .gte('completed_at', today + 'T00:00:00')
    .lt('completed_at', tomorrow + 'T00:00:00')
    .order('completed_at', { ascending: false })

  const tasks = [...(openTasks || []), ...(doneToday || [])]

  // 3. Task assignments
  const taskIds = tasks.map(t => t.id)
  let assignments: any[] = []
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from('daily_task_assignments')
      .select('task_id, team_member_id')
      .in('task_id', taskIds)
    assignments = data || []
  }

  // 4. Active invoices — match the invoice manager filter exactly
  //    (doc_type=invoice, status != archived, bucket not in archive/cold)
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_number, doc_type, customer_name, customer_email, customer_phone, company_name, vehicle_description, project_description, total, amount_paid, balance_due, due_date, fulfillment_type, production_stage, production_target_date, production_status_id, production_status_note, production_leader_id, status, in_production, attachments, notes, customer_id, bucket')
    .eq('doc_type', 'invoice')
    .neq('status', 'archived')
    .eq('production_archived', false)
    .not('bucket', 'in', '("ARCHIVE_WON","ARCHIVE_LOST","COLD")')
    .order('created_at', { ascending: false })

  // 5. Line items per project (qty, unit_price, line_total, attachments)
  const docIds = (docs || []).map(d => d.id)
  let lineItems: any[] = []
  if (docIds.length > 0) {
    const { data } = await supabase
      .from('line_items')
      .select('id, document_id, category, line_type, description, quantity, unit_price, line_total, attachments, sort_order')
      .in('document_id', docIds)
      .order('sort_order', { ascending: true })
    lineItems = data || []
  }

  // 5b. Payments per project (for sidebar)
  let payments: any[] = []
  if (docIds.length > 0) {
    const { data } = await supabase
      .from('payments')
      .select('id, document_id, amount, processing_fee, method, status, note, created_at')
      .in('document_id', docIds)
      .order('created_at', { ascending: false })
    payments = data || []
  }

  // 6. Team members
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name, short_name, color, role')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  // 7. Production statuses (for project pane status pill display)
  const { data: productionStatuses } = await supabase
    .from('production_statuses')
    .select('id, stage_key, label, color')
    .eq('active', true)

  // 8. Categories (for line-item type display)
  const { data: categories } = await supabase
    .from('categories')
    .select('category_key, parent_category, label')
    .eq('active', true)

  // 9. Production pipeline configs (template tasks per category)
  const { data: pipelineConfigs } = await supabase
    .from('production_pipeline_configs')
    .select('category_key, track, track_label, task_key, task_label, task_icon, sort_order')
    .order('category_key')
    .order('track')
    .order('sort_order')

  // 10. Recurring tasks (for the gear-icon settings)
  const { data: recurringTasks } = await supabase
    .from('recurring_tasks')
    .select('*')
    .order('created_at', { ascending: true })

  // 11. Calendar events for the bottom calendar widget (past week → next 60 days)
  const calStart = addDaysISO(today, -7) + 'T00:00:00'
  const calEnd   = addDaysISO(today, 60) + 'T23:59:59'
  const { data: calendarEvents } = await supabase
    .from('calendar_events')
    .select('id, title, event_type, start_time, end_time, vehicle_start, vehicle_end, install_start, install_end, customer_name, customer_phone, vehicle_description, document_id, status, notes, category')
    .gte('start_time', calStart)
    .lte('start_time', calEnd)
    .order('start_time', { ascending: true })

  return (
    <DailyPlan
      initialTasks={tasks}
      initialAssignments={assignments}
      docs={docs || []}
      lineItems={lineItems}
      teamMembers={teamMembers || []}
      productionStatuses={productionStatuses || []}
      categories={categories || []}
      pipelineConfigs={pipelineConfigs || []}
      initialRecurringTasks={recurringTasks || []}
      calendarEvents={calendarEvents || []}
      payments={payments}
    />
  )
}
