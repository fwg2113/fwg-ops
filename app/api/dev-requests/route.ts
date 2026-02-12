import { supabase } from '@/app/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET - Fetch all dev requests
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('dev_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - Create a new dev request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { data, error } = await supabase
      .from('dev_requests')
      .insert({
        title: body.title,
        request_type: body.request_type || 'bug',
        priority: body.priority || 'medium',
        where_in_app: body.where_in_app || null,
        what_happened: body.what_happened || null,
        steps_to_reproduce: body.steps_to_reproduce || null,
        expected_behavior: body.expected_behavior || null,
        actual_behavior: body.actual_behavior || null,
        why_needed: body.why_needed || null,
        submitted_by: body.submitted_by || 'Team',
        screenshot_url: body.screenshot_url || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ request: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH - Update a dev request (status, dev_notes, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing request ID' }, { status: 400 })
    }

    // If resolving, set resolved_at
    if (updates.status === 'resolved' || updates.status === 'closed') {
      updates.resolved_at = new Date().toISOString()
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('dev_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ request: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
