'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { playSound, playCustomSound } from '../lib/notificationSounds'

type NotificationSettings = {
  sound_enabled: boolean
  sound_key: string
  start_hour: number
  end_hour: number
  repeat_interval: number
  email_alerts_enabled: boolean
  email_alert_address: string
}

type CustomSound = {
  id: string
  label: string
  dataUrl: string
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
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([])
  const [hasInteracted, setHasInteracted] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const settingsRef = useRef(settings)
  const customSoundsRef = useRef(customSounds)
  settingsRef.current = settings
  customSoundsRef.current = customSounds

  // Load settings on mount and when they change
  const loadSettings = useCallback(async () => {
    try {
      const [notifRes, soundsRes] = await Promise.all([
        fetch('/api/settings/notifications'),
        fetch('/api/settings/notification-sounds'),
      ])
      const notifData = await notifRes.json()
      const soundsData = await soundsRes.json()
      setSettings(notifData)
      setCustomSounds(soundsData.sounds || [])
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
      : hour >= s.start_hour || hour < s.end_hour

    if (!inActiveHours) return

    // Check for unread messages
    try {
      const res = await fetch('/api/messages/unread-count')
      const data = await res.json()
      if (data.count > 0) {
        if (s.sound_key.startsWith('custom:')) {
          const customId = s.sound_key.replace('custom:', '')
          const customSound = customSoundsRef.current.find(cs => cs.id === customId)
          if (customSound) {
            playCustomSound(customSound.dataUrl)
          } else {
            playSound('chime') // fallback
          }
        } else {
          playSound(s.sound_key)
        }
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
