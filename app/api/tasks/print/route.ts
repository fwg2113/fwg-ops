import { supabase } from '../../../lib/supabase'

const priorityColors: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#6b7280'
}

const statusLabels: Record<string, string> = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  STUCK: 'Stuck',
  COMPLETED: 'Completed'
}

export async function GET() {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .or('archived.is.null,archived.eq.false')
    .or('auto_generated.is.null,auto_generated.eq.false')
    .neq('status', 'COMPLETED')
    .order('created_at', { ascending: false })

  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name, color')
    .eq('active', true)

  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('task_id, team_member_id')

  const { data: documents } = await supabase
    .from('documents')
    .select('id, doc_id, doc_number, type, customer_id, customers(id, display_name)')

  const tmMap = new Map((teamMembers || []).map(tm => [tm.id, tm]))

  const getAssigned = (taskId: string) => {
    return (assignments || [])
      .filter(a => a.task_id === taskId)
      .map(a => tmMap.get(a.team_member_id))
      .filter(Boolean)
  }

  const getLeader = (leaderId: string | null) => {
    if (!leaderId) return null
    return tmMap.get(leaderId) || null
  }

  const getCustomer = (invoiceId: string | null) => {
    if (!invoiceId) return null
    const doc = (documents || []).find((d: any) => d.doc_id === invoiceId)
    if (!doc || !doc.customers) return null
    const customers = doc.customers as any[]
    return customers?.[0]?.display_name || null
  }

  const now = new Date()
  const printDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const printTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  // Group by status (To Do first, then In Progress, then Stuck)
  const statusOrder = ['TO_DO', 'IN_PROGRESS', 'STUCK']
  const grouped = statusOrder.map(status => ({
    status,
    label: statusLabels[status],
    tasks: (tasks || []).filter(t => t.status === status && !t.parent_task_id)
  })).filter(g => g.tasks.length > 0)

  // Get subtasks
  const getSubtasks = (parentId: string) => (tasks || []).filter(t => t.parent_task_id === parentId)

  const taskRowsHtml = grouped.map(group => {
    const rows = group.tasks.map(task => {
      const assigned = getAssigned(task.id)
      const leader = getLeader(task.task_leader_id)
      const customer = getCustomer(task.invoice_id)
      const subtasks = getSubtasks(task.id)
      const pColor = priorityColors[task.priority] || '#6b7280'

      let dueHtml = ''
      if (task.due_date) {
        const d = new Date(task.due_date + 'T00:00:00')
        dueHtml = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }

      const peopleHtml = [
        ...(leader ? [`<span class="person leader" style="border-color:${leader.color}; color:${leader.color}">★ ${leader.name}</span>`] : []),
        ...assigned.map((tm: any) => `<span class="person" style="border-color:${tm.color}30; color:${tm.color}">${tm.name}</span>`)
      ].join('')

      const subtaskHtml = subtasks.length > 0
        ? `<div class="subtasks">${subtasks.map(st => `<div class="subtask"><span class="check">${st.status === 'COMPLETED' ? '☑' : '☐'}</span>${st.title}</div>`).join('')}</div>`
        : ''

      return `
        <tr>
          <td class="task-cell">
            <div class="task-title">${task.title}</div>
            ${customer ? `<div class="task-customer">${customer}</div>` : ''}
            ${peopleHtml ? `<div class="people">${peopleHtml}</div>` : ''}
            ${subtaskHtml}
          </td>
          <td class="priority-cell"><span class="priority" style="color:${pColor}; border-color:${pColor}">${task.priority}</span></td>
          <td class="due-cell">${dueHtml}</td>
          <td class="notes-cell"></td>
        </tr>`
    }).join('')

    return `
      <tr class="section-header"><td colspan="4">${group.label} <span class="count">(${group.tasks.length})</span></td></tr>
      ${rows}`
  }).join('')

  const totalTasks = grouped.reduce((sum, g) => sum + g.tasks.length, 0)

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Task List — ${printDate}</title>
  <style>
    @page { size: letter portrait; margin: 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a1a; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 12px; border-bottom: 3px solid #CE0000; margin-bottom: 16px;
    }
    .logo { height: 30px; }
    .header-right { text-align: right; }
    .header-date { font-size: 13px; font-weight: 600; color: #1a1a1a; }
    .header-time { font-size: 11px; color: #6b7280; }
    .header-count { font-size: 11px; color: #6b7280; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; font-size: 9px; font-weight: 700; color: #9ca3af;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 6px 8px; border-bottom: 1px solid #e5e7eb;
    }
    td { padding: 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }

    .section-header td {
      font-size: 12px; font-weight: 700; color: #374151;
      background: #f9fafb; padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .section-header .count { font-weight: 500; color: #9ca3af; }

    .task-cell { width: 55%; }
    .priority-cell { width: 10%; }
    .due-cell { width: 10%; font-size: 12px; color: #6b7280; }
    .notes-cell { width: 25%; }

    .task-title { font-size: 13px; font-weight: 600; color: #111; }
    .task-customer { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .people { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .person {
      font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 8px;
      border: 1px solid; background: #fff;
    }
    .person.leader { font-weight: 700; }
    .priority {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
      border: 1px solid; text-transform: uppercase;
    }

    .subtasks { margin-top: 4px; padding-left: 4px; }
    .subtask { font-size: 11px; color: #374151; padding: 1px 0; }
    .check { margin-right: 4px; font-size: 12px; }

    .notes-cell {
      background: repeating-linear-gradient(
        transparent, transparent 18px, #f0f0f0 18px, #f0f0f0 19px
      );
      min-height: 40px;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="/images/fwg-logo.svg" class="logo" alt="FWG" />
    <div class="header-right">
      <div class="header-date">${printDate}</div>
      <div class="header-time">Printed at ${printTime}</div>
      <div class="header-count">${totalTasks} active tasks</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Task</th>
        <th>Priority</th>
        <th>Due</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${taskRowsHtml}
    </tbody>
  </table>

  <script>window.onload = function() { window.print() }</script>
</body>
</html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}
