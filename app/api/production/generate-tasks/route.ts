/**
 * API Route: Generate Production Tasks
 * POST /api/production/generate-tasks
 *
 * Generates production tasks for all line items in an invoice
 * based on their category templates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateProductionTasks } from '@/app/lib/production/taskGenerator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId } = body

    // Validation
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      )
    }

    // Generate tasks
    const result = await generateProductionTasks(invoiceId)

    // Return result
    if (result.success) {
      return NextResponse.json({
        ...result,
        message: `Generated ${result.totalTasksCreated} tasks across ${result.lineItemsProcessed} line items`
      })
    } else {
      return NextResponse.json(
        {
          ...result,
          message: 'Task generation completed with errors'
        },
        { status: 207 } // Multi-status (partial success)
      )
    }

  } catch (error: any) {
    console.error('Error generating production tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
