import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const NIH_TEAM_PHONES: Record<string, string> = {
  'Sydney': '3014731648',
  'Joe': '2407518588',
  'Sharyn': '2402745632',
  'Joey': '2404093649',
  'Danny': '3017883299',
  'Mikey': '4107132082',
  'Jay': '4102363945',
  'Mason': '2404093650',
  'Diogo': '2408556470',
  'Bronson': '6614710411',
  'Trinity': '2406565570',
}

async function sendTaskNotifications(title: string, description: string | null, totalPoints: number, isProject?: boolean, taskBucket?: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio not configured — skipping task notifications')
    return
  }

  let body = `🆕 New Task Added!\n\n📋 ${title}`
  if (description) {
    body += `\n\n${description}`
  }
  if (isProject) {
    body += `\n\n⭐ Project Task — points on subtasks`
  } else {
    body += `\n\n⭐ ${totalPoints} point${totalPoints !== 1 ? 's' : ''}`
  }

  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://hands.frederickwraps.com'
  const bucket = taskBucket || 'whenever'
  body += `\n\n👉 ${baseUrl}/hands?bucket=${bucket}`

  const phones = Object.values(NIH_TEAM_PHONES)

  await Promise.allSettled(
    phones.map(async (phone) => {
      const to = '+1' + phone
      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
          }
        )
        if (!response.ok) {
          const err = await response.json()
          console.error(`SMS failed to ${to}:`, err.message)
        }
      } catch (e) {
        console.error(`SMS error to ${to}:`, e)
      }
    })
  )
}

export async function GET() {
  const { data, error } = await supabase
    .from('nih_tasks')
    .select('*, nih_categories(*), nih_locations(*), nih_task_assignees(*, nih_team_members(*))')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { title, description, category_id, location_id, urgency, time_estimate, is_project, parent_id, point_of_contact, assignee_ids, points, is_recurring, recurring_days, task_bucket } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Get max sort_order for positioning
  const { data: maxSort } = await supabase
    .from('nih_tasks')
    .select('sort_order')
    .is('parent_id', parent_id || null)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (maxSort?.[0]?.sort_order ?? -1) + 1

  const { data: task, error } = await supabase
    .from('nih_tasks')
    .insert({
      title: title.trim(),
      description: description || null,
      category_id: category_id || null,
      location_id: location_id || null,
      urgency: urgency || 'medium',
      time_estimate: time_estimate || null,
      is_project: is_project || false,
      parent_id: parent_id || null,
      point_of_contact: point_of_contact || null,
      points: points || 0,
      is_recurring: is_recurring || false,
      recurring_days: recurring_days || [],
      task_bucket: (is_recurring ? 'recurring' : task_bucket) || 'whenever',
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Add assignees if provided
  if (assignee_ids?.length && task) {
    const assigneeRows = assignee_ids.map((memberId: string) => ({
      task_id: task.id,
      team_member_id: memberId,
    }))
    await supabase.from('nih_task_assignees').insert(assigneeRows)
  }

  // Send SMS notifications for top-level tasks (not subtasks)
  if (task && !parent_id) {
    // Fire and forget — don't block the response
    sendTaskNotifications(task.title, task.description, task.points || 0, task.is_project, task.task_bucket).catch((e) =>
      console.error('Task notification error:', e)
    )
  }

  return NextResponse.json(task, { status: 201 })
}
