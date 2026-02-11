'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { playSound, type SoundKey } from '../lib/notificationSounds'

type NotificationSettings = {
  sound_enabled: boolean
  sound_key: SoundKey
  start_hour: number
  end_hour: number
  repeat_interval: number
  email_alerts_enabled: boolean
  email_alert_address: string
}

const DEFAULT_SETTINGS: NotificationSettings = {
  sound_enabled: true,
  sound_key: 'chime',
  start_hour: 9,
  end_hour: 17,
  repeat_interval: 60,
  email_alerts_enabled: true,
  email_alert_address: 'info@frederickwraps.com',
}

export default function NotificationManager() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [hasInteracted, setHasInteracted] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Load settings on mount and when they change
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/notifications')
      const data = await res.json()
      setSettings(data)
    } catch {
      // Use defaults
    }
  }, [])

  useEffect(() => {
    loadSettings()
    const handler = () => loadSettings()
    window.addEventListener('notification-settings-changed', handler)
    return () => window.removeEventListener('notification-settings-changed', handler)
  }, [loadSettings])

  // Track user interaction (required for Web Audio API)
  useEffect(() => {
    const handler = () => setHasInteracted(true)
    window.addEventListener('click', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [])

  // Check unread and play sound
  const checkAndAlert = useCallback(async () => {
    const s = settingsRef.current
    if (!s.sound_enabled || !hasInteracted) return

    // Check if within active hours
    const now = new Date()
    const hour = now.getHours()
    const inActiveHours = s.start_hour <= s.end_hour
      ? hour >= s.start_hour && hour < s.end_hour
      : hour >= s.start_hour || hour < s.end_hour // handles overnight like 22-6

    if (!inActiveHours) return

    // Check for unread messages
    try {
      const res = await fetch('/api/messages/unread-count')
      const data = await res.json()
      if (data.count > 0) {
        playSound(s.sound_key)
      }
    } catch {
      // Silently fail
    }
  }, [hasInteracted])

  // Set up the repeating check
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      checkAndAlert()
    }, 5000)

    // Set up repeating interval
    intervalRef.current = setInterval(checkAndAlert, settings.repeat_interval * 1000)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [settings.repeat_interval, checkAndAlert])

  // This component renders nothing visible
  return null
}
