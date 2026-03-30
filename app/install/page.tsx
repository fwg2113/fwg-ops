import { supabase } from '../lib/supabase'
import CalendarView from '../(dashboard)/calendar/CalendarView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InstallPage() {
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_time', { ascending: true })

  // Get unique document IDs from events
  const docIds = (events || [])
    .map(e => e.document_id)
    .filter((id): id is string => !!id)
    .filter((id, i, arr) => arr.indexOf(id) === i)

  // Fetch linked documents
  let documentMap: Record<string, any> = {}
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, vehicle_description, customer_name, customer_email, customer_phone, company_name, category, balance_due, attachments')
      .in('id', docIds)

    const { data: lineItems } = await supabase
      .from('line_items')
      .select('id, document_id, description, quantity, category, line_type, package_key, sort_order, attachments, custom_fields')
      .in('document_id', docIds)
      .order('sort_order', { ascending: true })

    for (const doc of docs || []) {
      documentMap[doc.id] = {
        vehicle_description: doc.vehicle_description,
        customer_name: doc.customer_name,
        customer_email: doc.customer_email,
        customer_phone: doc.customer_phone,
        company_name: doc.company_name,
        category: doc.category,
        has_balance: (doc.balance_due || 0) > 0,
        attachments: doc.attachments || [],
        line_items: (lineItems || [])
          .filter(li => li.document_id === doc.id)
          .map(li => ({
            id: li.id,
            description: li.description,
            quantity: li.quantity,
            category: li.category,
            line_type: li.line_type,
            package_key: li.package_key,
            attachments: li.attachments || [],
            custom_fields: li.custom_fields || {},
          }))
      }
    }
  }

  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name, short_name, color, role')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const { data: assignments } = await supabase
    .from('calendar_event_assignments')
    .select('event_id, team_member_id')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '16px', overflow: 'hidden' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <img src="/images/fwg-ops-icon.svg" alt="FWG OPS" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: 'rgba(148,163,184,0.2)' }} />
          <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Install Schedule</span>
        </div>
        <CalendarView initialEvents={events || []} documentMap={documentMap} readOnly={true} initialTeamMembers={teamMembers || []} initialAssignments={assignments || []} showTeamFilter={true} />
      </div>
    </div>
  )
}
