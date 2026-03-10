import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const resend = new Resend(process.env.RESEND_API_KEY)

const VALID_STATUSES = ['new', 'in_production', 'printed', 'ready_for_pickup', 'shipped', 'completed', 'cancelled']

const FROM_EMAIL = 'orders@frederickapparel.com'

function getEmailContent(status: string, customerName: string, trackingNumber?: string): { subject: string; text: string } | null {
  const name = customerName || 'there'

  switch (status) {
    case 'in_production':
      return {
        subject: 'Your order is in production — Frederick Apparel',
        text: `Hi ${name},\n\nGreat news — your order is now in production! Our team is printing it and we'll let you know as soon as it's ready.\n\nIf you have any questions in the meantime, feel free to reply to this email or text us at 240-693-3715.\n\nThank you,\nFrederick Apparel`,
      }
    case 'printed':
      return {
        subject: 'Your order has been printed — Frederick Apparel',
        text: `Hi ${name},\n\nYour order has been printed and is moving to the next step. We'll reach out again once it's ready for pickup or has shipped.\n\nIf you have any questions, feel free to reply to this email or text us at 240-693-3715.\n\nThank you,\nFrederick Apparel`,
      }
    case 'ready_for_pickup':
      return {
        subject: 'Your order is ready for pickup — Frederick Apparel',
        text: `Hi ${name},\n\nYour order is ready for pickup! You can come by anytime during business hours at:\n\nFrederick Wraps & Graphics\n5728 Buckeystown Pike\nFrederick, MD 21704\n\nPlease text 240-693-3715 when you arrive and we'll bring it right out.\n\nThank you,\nFrederick Apparel`,
      }
    case 'shipped': {
      const trackingLine = trackingNumber ? `\n\nYour tracking number is: ${trackingNumber}` : ''
      return {
        subject: 'Your order has shipped — Frederick Apparel',
        text: `Hi ${name},\n\nYour order is on its way! You should receive it soon.${trackingLine}\n\nIf you have any questions, feel free to reply to this email or text us at 240-693-3715.\n\nThank you,\nFrederick Apparel`,
      }
    }
    default:
      return null
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { status, notes, tracking_number } = await request.json()

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = status
    }

    if (notes !== undefined) {
      updates.staff_notes = notes
    }

    if (tracking_number !== undefined) {
      updates.tracking_number = tracking_number
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send customer notification email for relevant status changes
    if (status && data?.email) {
      const emailContent = getEmailContent(status, data.customer_name, data.tracking_number)
      if (emailContent) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: data.email,
            subject: emailContent.subject,
            text: emailContent.text,
          })
        } catch (emailError) {
          console.error('Failed to send FA order notification email:', emailError)
        }
      }
    }

    return NextResponse.json({ success: true, order: data })
  } catch (error) {
    console.error('FA order status update error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
