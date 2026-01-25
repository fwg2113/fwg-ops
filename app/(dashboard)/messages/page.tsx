import { supabase } from '../../lib/supabase'
import MessageList from './MessageList'

export default async function MessagesPage() {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  // Group messages by phone number
  const conversations = messages?.reduce((acc: any, msg) => {
    const key = msg.customer_phone
    if (!acc[key]) {
      acc[key] = {
        phone: msg.customer_phone,
        customer_name: msg.customer_name,
        messages: [],
        lastMessage: msg.message_body,
        lastMessageAt: msg.created_at,
        unread: 0
      }
    }
    acc[key].messages.push(msg)
    if (msg.read === 'false' || msg.read === false) {
      acc[key].unread++
    }
    return acc
  }, {})

  return <MessageList conversations={Object.values(conversations || {})} />
}