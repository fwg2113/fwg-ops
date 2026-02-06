import { NextRequest, NextResponse } from 'next/server'
import { syncPaymentToSheet } from '@/app/lib/payment-sheet-sync'

/**
 * POST /api/payments/sync-to-sheet
 *
 * Manually sync a payment to Google Sheets TRANSACTIONS
 *
 * Body: { paymentId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json()

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'Payment ID is required' },
        { status: 400 }
      )
    }

    // Sync the payment
    const result = await syncPaymentToSheet(paymentId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        rowsAdded: result.rowsAdded,
        txnNumbers: result.txnNumbers,
        message: `Successfully synced ${result.rowsAdded} row(s) to Google Sheets`
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to sync payment'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in sync-to-sheet API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    )
  }
}
