import { Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import MessageList from './MessageList'

export default async function MessagesPage() {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <Suspense fallback={<div style={{ color: '#94a3b8', padding: '40px', textAlign: 'center' }}>Loading messages...</div>}>
      <MessageList initialMessages={messages || []} initialCalls={calls || []} />
    </Suspense>
  )
}
