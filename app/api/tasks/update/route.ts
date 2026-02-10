import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { isAutomationEnabled } from '../../../lib/automation-settings'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { taskId, status, title, description, priority, due_date, notes } = body

    console.log('[API /tasks/update] Received request:', { taskId, status, title, description, priority, due_date, notes })

    // Build update object with only provided fields
    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (priority !== undefined) updateData.priority = priority
    if (due_date !== undefined) updateData.due_date = due_date || null
    if (notes !== undefined) updateData.notes = notes

    console.log('[API /tasks/update] Updating task with data:', updateData)

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select('id, title, description, status, priority, due_date, created_at, invoice_id, submission_id, quote_id, notes, started_at, time_spent_minutes, line_item_id, document_id')
      .single()

    if (error) {
      console.error('[API /tasks/update] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[API /tasks/update] Task updated successfully:', data)

    // Automation #2: Customer notification on task completion
    if (status === 'COMPLETED' && data.line_item_id) {
      const automationEnabled = await isAutomationEnabled('notify_customer_on_completion')

      if (automationEnabled) {
        try {
          // Check if all tasks for this line item are completed
          const { data: allLineTasks } = await supabase
            .from('tasks')
            .select('id, status')
            .eq('line_item_id', data.line_item_id)

          const allCompleted = allLineTasks?.every(t => t.status === 'COMPLETED')

          if (allCompleted && allLineTasks && allLineTasks.length > 0) {
            // Get line item and document details
            const { data: lineItem } = await supabase
              .from('line_items')
              .select('id, category, description')
              .eq('id', data.line_item_id)
              .single()

            const { data: document } = await supabase
              .from('documents')
              .select('id, doc_number, customer_name, customer_phone, customer_email, vehicle_description')
              .eq('id', data.document_id)
              .single()

            if (document) {
              // Send SMS notification if customer has phone
              if (document.customer_phone) {
                const twilioSid = process.env.TWILIO_ACCOUNT_SID
                const twilioToken = process.env.TWILIO_AUTH_TOKEN
                const twilioPhone = process.env.TWILIO_PHONE_NUMBER

                if (twilioSid && twilioToken && twilioPhone) {
                  const message = `Hi ${document.customer_name}! Great news - your ${lineItem?.description || 'service'} is complete and ready for pickup! Contact us to schedule: (301) 620-4275. -Frederick Wraps & Graphics`

                  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                      To: document.customer_phone,
                      From: twilioPhone,
                      Body: message
                    })
                  })

                  console.log(`[Automation] Sent completion SMS to ${document.customer_name} for line item ${lineItem?.description}`)
                }
              }

              // Send email notification if customer has email
              if (document.customer_email) {
                const resendApiKey = process.env.RESEND_API_KEY

                if (resendApiKey) {
                  await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${resendApiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      from: 'FWG Ops <quotes@frederickwraps.com>',
                      to: [document.customer_email],
                      subject: `Your ${lineItem?.description || 'Service'} is Ready for Pickup!`,
                      html: `
                        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                          <h1 style="background: linear-gradient(135deg, #d71cd1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Great News!</h1>
                          <p>Hi ${document.customer_name},</p>
                          <p>We're excited to let you know that your <strong>${lineItem?.description || 'service'}</strong> is complete and ready for pickup!</p>
                          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Invoice #${document.doc_number}</strong></p>
                            ${document.vehicle_description ? `<p style="margin: 8px 0 0 0; color: #666;">${document.vehicle_description}</p>` : ''}
                          </div>
                          <p><strong>Next Steps:</strong></p>
                          <ul>
                            <li>Call us to schedule your pickup: <a href="tel:+13016204275">(301) 620-4275</a></li>
                            <li>Visit us at: 4314 Markell Dr, Frederick, MD 21703</li>
                          </ul>
                          <p>We look forward to seeing you soon!</p>
                          <p style="color: #666; font-size: 14px; margin-top: 30px;">
                            Frederick Wraps & Graphics<br/>
                            (301) 620-4275<br/>
                            info@frederickwraps.com
                          </p>
                        </div>
                      `,
                    }),
                  })

                  console.log(`[Automation] Sent completion email to ${document.customer_name} for line item ${lineItem?.description}`)
                }
              }
            }
          }
        } catch (autoError) {
          console.error('[Automation] Failed to send completion notification:', autoError)
          // Don't fail the task update if notification fails
        }
      }
    }

    // Automation #3: Production complete → Action Center handoff
    // When ALL production tasks for a document are complete, create NOTIFY_COMPLETION customer action
    if (status === 'COMPLETED' && data.document_id) {
      try {
        const { data: allDocTasks } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('document_id', data.document_id)
          .eq('auto_generated', true)
          .or('archived.is.null,archived.eq.false')

        const allDone = allDocTasks && allDocTasks.length > 0 && allDocTasks.every(t => t.status === 'COMPLETED')

        if (allDone) {
          // Check if a NOTIFY_COMPLETION action already exists for this document
          const { data: existingNotify } = await supabase
            .from('customer_actions')
            .select('id')
            .eq('document_id', data.document_id)
            .eq('step_key', 'NOTIFY_COMPLETION')
            .eq('status', 'TODO')

          if (!existingNotify || existingNotify.length === 0) {
            // Get document category to find the right template
            const { data: doc } = await supabase
              .from('documents')
              .select('category')
              .eq('id', data.document_id)
              .single()

            const templateKey = doc?.category ? `${doc.category}_CUSTOMER` : 'OTHER_CUSTOMER'

            await supabase.from('customer_actions').insert({
              document_id: data.document_id,
              template_key: templateKey,
              step_key: 'NOTIFY_COMPLETION',
              title: 'Notify customer - production complete',
              description: 'All production tasks are done. Notify the customer their order is ready.',
              status: 'TODO',
              priority: 'HIGH',
              sort_order: 100,
              auto_complete_on_status: null,
              auto_generated: true
            })

            console.log(`[Automation] Created NOTIFY_COMPLETION action for document ${data.document_id}`)
          }
        }
      } catch (autoError) {
        console.error('[Automation] Failed to create production-complete action:', autoError)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
