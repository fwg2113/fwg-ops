import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { autoCompleteActions } from '@/app/lib/customer/actionGenerator'

export async function POST(request: Request) {
  try {
    const { documentId, status } = await request.json()

    if (!documentId || !status) {
      return NextResponse.json({ error: 'Missing documentId or status' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-complete any customer actions triggered by this status change
    await autoCompleteActions(documentId, status)

    return NextResponse.json({ success: true, document: data })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
