import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FA_API = 'https://frederickapparel.com/api/artwork/generate-pdf'

export async function POST(request: NextRequest) {
  try {
    const { session_token } = await request.json()

    if (!session_token) {
      return NextResponse.json({ error: 'session_token is required' }, { status: 400 })
    }

    console.log('[regenerate-pdf] Proxying to FA for session:', session_token)

    const res = await fetch(FA_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[regenerate-pdf] FA returned', res.status, data)
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Proxy failed'
    console.error('[regenerate-pdf] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
