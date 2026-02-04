/**
 * API Route: Regenerate Production Tasks for Line Item
 * POST /api/production/regenerate-line-item
 *
 * Deletes existing auto-generated tasks and creates fresh ones
 * for a specific line item.
 */

import { NextRequest, NextResponse } from 'next/server'
import { regenerateTasksForLineItem } from '@/app/lib/production/taskGenerator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, lineItemId } = body

    // Validation
    if (!invoiceId || !lineItemId) {
      return NextResponse.json(
        { error: 'invoiceId and lineItemId are required' },
        { status: 400 }
      )
    }

    // Regenerate tasks
    const result = await regenerateTasksForLineItem(invoiceId, lineItemId)

    // Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Regenerated ${result.totalTasksCreated} tasks for line item`,
        ...result
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Task regeneration failed',
          ...result
        },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Error regenerating tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
