import { NextResponse } from 'next/server'
import { completeAction } from '@/app/lib/customer/actionGenerator'

export async function POST(request: Request) {
  try {
    const { actionId } = await request.json()

    if (!actionId) {
      return NextResponse.json({ error: 'Missing actionId' }, { status: 400 })
    }

    const result = await completeAction(actionId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Complete customer action error:', error)
    return NextResponse.json({ error: 'Failed to complete action' }, { status: 500 })
  }
}
