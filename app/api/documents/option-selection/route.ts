import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(request: NextRequest) {
  try {
    const { documentId, optionId, optionTitle, question, customerName } = await request.json()

    if (!documentId || !optionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const timestamp = new Date().toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true 
    })
    
    let noteEntry = `** OPTION SELECTED (${timestamp}) **\n`
    noteEntry += `Customer: ${customerName}\n`
    noteEntry += `Selected: ${optionTitle}\n`
    if (question) {
      noteEntry += `Question: ${question}\n`
    }

    const existingNotes = doc.notes || ''
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${noteEntry}` : noteEntry

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'option_selected',
        notes: updatedNotes
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    const businessPhone = process.env.TWILIO_PHONE_TO || '+12406933715'
    let smsBody = `Option Selected!\n${customerName} selected "${optionTitle}" on Quote #${doc.doc_number}`
    if (question) {
      smsBody += `\n\nQuestion: ${question}`
    }

    try {
      await twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: businessPhone
      })
    } catch (smsError) {
      console.error('SMS error:', smsError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Option selection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}