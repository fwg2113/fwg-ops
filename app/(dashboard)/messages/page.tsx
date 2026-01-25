import { supabase } from '../../lib/supabase'
import MessageList from './MessageList'

export default async function MessagesPage() {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  return <MessageList initialMessages={messages || []} />
}
