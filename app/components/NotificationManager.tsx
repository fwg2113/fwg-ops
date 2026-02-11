'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { playSound, playCustomSound } from '../lib/notificationSounds'

type NotificationSettings = {
  sound_enabled: boolean
  sound_key: string
  message_sound_key: string
  email_sound_key: string
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
  message_sound_key: 'chime',
  email_sound_key: 'bell',
  start_hour: 9,
  end_hour: 17,
  repeat_interval: 60,
  email_alerts_enabled: true,
  email_alert_address: 'info@frederickwraps.com',
}

function playSoundByKey(key: string, customSounds: CustomSound[]) {
  if (key.startsWith('custom:')) {
    const customId = key.replace('custom:', '')
    const customSound = customSounds.find(cs => cs.id === customId)
    if (customSound) {
      playCustomSound(customSound.dataUrl)
    } else {
      playSound('chime')
    }
  } else {
    playSound(key)
  }
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

  // Check unread messages and emails, play appropriate sounds
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

    // Check both unread counts in parallel
    try {
      const [msgRes, emailRes] = await Promise.all([
        fetch('/api/messages/unread-count'),
        fetch('/api/gmail/unread-count'),
      ])
      const msgData = await msgRes.json()
      const emailData = await emailRes.json()

      const soundKey = s.message_sound_key || s.sound_key || 'chime'
      const emailKey = s.email_sound_key || 'bell'

      // Play message sound if unread messages
      if (msgData.count > 0) {
        playSoundByKey(soundKey, customSoundsRef.current)
      }

      // Play email sound if unread emails (stagger by 1.5s to avoid overlap)
      if (emailData.count > 0) {
        if (msgData.count > 0) {
          setTimeout(() => {
            playSoundByKey(emailKey, customSoundsRef.current)
          }, 1500)
        } else {
          playSoundByKey(emailKey, customSoundsRef.current)
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
