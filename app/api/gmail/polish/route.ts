import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { draft, threadContext, subject } = await request.json()

    if (!draft?.trim()) {
      return NextResponse.json({ error: 'No draft text provided' }, { status: 400 })
    }

    // Build context for Claude to understand the situation
    let contextBlock = ''
    if (threadContext && threadContext.length > 0) {
      contextBlock = `\n\nHere is the recent thread history for context (most recent last):\n`
      for (const msg of threadContext.slice(-4)) {
        const sender = msg.from?.includes('frederickwraps') ? 'Us (Frederick Wraps)' : `Customer (${msg.from})`
        const snippet = msg.body?.replace(/<[^>]*>/g, '').substring(0, 300) || ''
        contextBlock += `---\n${sender}:\n${snippet}\n`
      }
    }

    const systemPrompt = `You are an email writing assistant for Frederick Wraps & Graphics, a vehicle wrapping, vinyl graphics, and apparel business in Frederick, MD. The owner is Joey.

Your job is to polish rough draft emails into professional, warm, and clear messages. Follow these rules:

- Keep the tone friendly and professional — never stiff or corporate
- Keep it concise. Business owners are busy. Say what needs to be said, nothing more
- Match the context: if it's a quote follow-up, be helpful. If it's scheduling, be direct. If it's a new lead, be welcoming
- Use "we" when speaking on behalf of the business, not "I" (unless the draft clearly uses "I" intentionally)
- Never add fake details, prices, dates, or promises that weren't in the draft
- Preserve the intent and all specific details from the draft — just improve the writing
- Don't add a subject line — just return the polished email body
- Don't add greetings or sign-offs if the draft doesn't have them (the user may want to add their own)
- If the draft already has a greeting/sign-off, keep them but polish them
- Return ONLY the polished email text, nothing else. No explanations, no "Here's the polished version", just the email.`

    const userMessage = `Polish this email draft for me.${subject ? `\n\nSubject: ${subject}` : ''}${contextBlock}\n\nMy rough draft:\n${draft}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Claude API error:', data)
      return NextResponse.json({ error: data.error?.message || 'Failed to polish email' }, { status: 500 })
    }

    const polished = data.content?.[0]?.text || ''

    return NextResponse.json({ polished })
  } catch (error: any) {
    console.error('Polish error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
