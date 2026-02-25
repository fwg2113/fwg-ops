import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

/**
 * Returns enabled team members for the transfer selection UI.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('call_settings')
      .select('name, phone')
      .eq('enabled', true)
      .order('ring_order', { ascending: true })

    if (error) {
      console.error('Team members query error:', error)
      return NextResponse.json({ members: [] })
    }

    return NextResponse.json({ members: data || [] })
  } catch (error) {
    console.error('Team members error:', error)
    return NextResponse.json({ members: [] })
  }
}
