import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

/**
 * DELETE /api/documents/[id]
 *
 * Deletes a document and its related data
 * - Checks if document has payments (prevents deletion if yes)
 * - Deletes related line_items
 * - Deletes related tasks
 * - Deletes the document
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params

    // Check if document exists
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, doc_number, doc_type, status')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if document has payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id')
      .eq('document_id', documentId)

    if (paymentsError) {
      return NextResponse.json(
        { success: false, error: `Failed to check payments: ${paymentsError.message}` },
        { status: 500 }
      )
    }

    if (payments && payments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete ${document.doc_type} #${document.doc_number} - it has ${payments.length} payment(s). Please delete payments first.`,
          hasPayments: true,
          paymentCount: payments.length
        },
        { status: 400 }
      )
    }

    // Delete related line_items
    const { error: lineItemsError } = await supabase
      .from('line_items')
      .delete()
      .eq('document_id', documentId)

    if (lineItemsError) {
      return NextResponse.json(
        { success: false, error: `Failed to delete line items: ${lineItemsError.message}` },
        { status: 500 }
      )
    }

    // Delete related tasks
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('document_id', documentId)

    if (tasksError) {
      // Don't fail if tasks table doesn't exist or other non-critical error
      console.warn('Failed to delete tasks:', tasksError)
    }

    // Delete related customer_actions
    const { error: actionsError } = await supabase
      .from('customer_actions')
      .delete()
      .eq('document_id', documentId)

    if (actionsError) {
      console.warn('Failed to delete customer actions:', actionsError)
    }

    // Clear submission reference to this document
    await supabase
      .from('submissions')
      .update({ converted_to_quote_id: null })
      .eq('converted_to_quote_id', documentId)

    // Delete the document
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: `Failed to delete document: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${document.doc_type} #${document.doc_number} deleted successfully`
    })
  } catch (error: any) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
