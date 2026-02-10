import { NextResponse } from 'next/server'
import { generateCustomerActions, generateSubmissionAction } from '@/app/lib/customer/actionGenerator'

export async function POST(request: Request) {
  try {
    const { documentId, submissionId, category } = await request.json()

    if (!documentId && !submissionId) {
      return NextResponse.json({ error: 'Missing documentId or submissionId' }, { status: 400 })
    }

    if (!category) {
      return NextResponse.json({ error: 'Missing category' }, { status: 400 })
    }

    if (documentId) {
      const result = await generateCustomerActions(documentId, category)
      return NextResponse.json(result)
    } else {
      const result = await generateSubmissionAction(submissionId, category)
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Generate customer actions error:', error)
    return NextResponse.json({ error: 'Failed to generate customer actions' }, { status: 500 })
  }
}
