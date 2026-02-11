import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const SETTINGS_KEY = 'notification_settings'

const DEFAULT_SETTINGS = {
  sound_enabled: true,
  sound_key: 'chime',
  start_hour: 9,
  end_hour: 17,
  repeat_interval: 60,
  email_alerts_enabled: true,
  email_alert_address: 'info@frederickwraps.com',
}

export async function GET() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      return NextResponse.json({ ...DEFAULT_SETTINGS, ...parsed })
    }
    return NextResponse.json(DEFAULT_SETTINGS)
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const settings = {
      sound_enabled: body.sound_enabled ?? DEFAULT_SETTINGS.sound_enabled,
      sound_key: body.sound_key ?? DEFAULT_SETTINGS.sound_key,
      start_hour: body.start_hour ?? DEFAULT_SETTINGS.start_hour,
      end_hour: body.end_hour ?? DEFAULT_SETTINGS.end_hour,
      repeat_interval: body.repeat_interval ?? DEFAULT_SETTINGS.repeat_interval,
      email_alerts_enabled: body.email_alerts_enabled ?? DEFAULT_SETTINGS.email_alerts_enabled,
      email_alert_address: body.email_alert_address ?? DEFAULT_SETTINGS.email_alert_address,
    }

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(settings),
      }, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, settings })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
