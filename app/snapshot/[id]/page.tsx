import { supabase } from '../../lib/supabase'
import SnapshotView from './SnapshotView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: snapshot } = await supabase
    .from('document_send_snapshots')
    .select('*')
    .eq('id', id)
    .single()

  if (!snapshot) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#1a1a1a', fontSize: '24px', marginBottom: '8px' }}>Snapshot Not Found</h1>
          <p style={{ color: '#6b7280' }}>This snapshot may have been removed or the link is invalid.</p>
        </div>
      </div>
    )
  }

  return <SnapshotView snapshot={snapshot} />
}
