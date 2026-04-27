// ============================================================================
// Daily Plan helpers
// ----------------------------------------------------------------------------
// Pure date math + recurring-task spawn logic. Used by the /page.tsx server
// component on each render to ensure today's recurring tasks exist.
// ============================================================================

export type RecurringPattern =
  | 'daily'
  | 'weekdays'
  | 'mon_wed_fri'
  | 'tue_thu'
  | `weekly:${0 | 1 | 2 | 3 | 4 | 5 | 6}`

export function shouldSpawnToday(pattern: string, dayOfWeek: number): boolean {
  // dayOfWeek: 0=Sun, 1=Mon, ... 6=Sat
  if (pattern === 'daily') return true
  if (pattern === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
  if (pattern === 'mon_wed_fri') return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5
  if (pattern === 'tue_thu') return dayOfWeek === 2 || dayOfWeek === 4
  if (pattern.startsWith('weekly:')) {
    const target = parseInt(pattern.slice(7), 10)
    return target === dayOfWeek
  }
  return false
}

// Format helpers — all in local time (assumes server runs America/New_York)
export function todayLocalISO(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysISO(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build the list of day-bucket dates from today through next Saturday
// e.g. if today is Sunday: [today, mon, tue, wed, thu, fri, sat]
// if today is Wednesday: [today, thu, fri, sat]
export function weekBucketDates(): string[] {
  const today = todayLocalISO()
  const todayDow = new Date(today + 'T00:00:00').getDay()
  const daysToSat = (6 - todayDow + 7) % 7
  const bucketCount = daysToSat === 0 ? 1 : daysToSat + 1
  return Array.from({ length: bucketCount }, (_, i) => addDaysISO(today, i))
}

export function formatBucketDate(iso: string): { label: string; pretty: string } {
  const today = todayLocalISO()
  const tomorrow = addDaysISO(today, 1)
  const d = new Date(iso + 'T00:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const pretty = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  if (iso === today) return { label: 'Today', pretty: `${weekday}, ${pretty}` }
  if (iso === tomorrow) return { label: 'Tomorrow', pretty: `${weekday}, ${pretty}` }
  return { label: weekday, pretty }
}

// ----------------------------------------------------------------------------
// Spawn recurring tasks into daily_tasks for today (idempotent)
// ----------------------------------------------------------------------------
type SupabaseClient = any // avoid importing types at this layer

export async function spawnRecurringForToday(supabase: SupabaseClient): Promise<void> {
  const today = todayLocalISO()
  const dow = new Date(today + 'T00:00:00').getDay()

  const { data: recurring, error } = await supabase
    .from('recurring_tasks')
    .select('*')
    .eq('active', true)
  if (error || !recurring) return

  const eligible = recurring.filter((r: any) => shouldSpawnToday(r.pattern, dow))
  if (eligible.length === 0) return

  // Pull any already-spawned-today rows so we don't duplicate
  const { data: existing } = await supabase
    .from('daily_tasks')
    .select('recurring_task_id')
    .eq('scheduled_date', today)
    .in('recurring_task_id', eligible.map((r: any) => r.id))

  const alreadySpawned = new Set((existing || []).map((r: any) => r.recurring_task_id))
  const toCreate = eligible.filter((r: any) => !alreadySpawned.has(r.id))
  if (toCreate.length === 0) return

  const inserts = toCreate.map((r: any) => ({
    title: r.title,
    description: r.description,
    scheduled_date: today,
    is_priority: r.default_priority,
    status: 'TODO',
    source: 'recurring',
    recurring_task_id: r.id,
    sort_order: 0,
  }))

  const { data: created } = await supabase.from('daily_tasks').insert(inserts).select('id, recurring_task_id')

  // Auto-assign: copy default_assignee_id into daily_task_assignments
  if (created && created.length > 0) {
    const assignmentRows: { task_id: string; team_member_id: string }[] = []
    for (const c of created) {
      const r = toCreate.find((x: any) => x.id === c.recurring_task_id)
      if (r?.default_assignee_id) {
        assignmentRows.push({ task_id: c.id, team_member_id: r.default_assignee_id })
      }
    }
    if (assignmentRows.length > 0) {
      await supabase.from('daily_task_assignments').insert(assignmentRows)
      // Update last_spawned_date
      await supabase
        .from('recurring_tasks')
        .update({ last_spawned_date: today })
        .in('id', toCreate.map((r: any) => r.id))
    }
  }
}
