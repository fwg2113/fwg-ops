import { NextResponse } from 'next/server'
import { autoCompleteActions } from '@/app/lib/customer/actionGenerator'

export async function POST(request: Request) {
  try {
    const { documentId, newStatus } = await request.json()

    if (!documentId || !newStatus) {
      return NextResponse.json({ error: 'Missing documentId or newStatus' }, { status: 400 })
    }

    const result = await autoCompleteActions(documentId, newStatus)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, completed: result.completed })
  } catch (error) {
    console.error('Auto-complete customer actions error:', error)
    return NextResponse.json({ error: 'Failed to auto-complete actions' }, { status: 500 })
  }
}
