'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { playSound, playCustomSound } from '../lib/notificationSounds'

type NotificationSettings = {
  sound_enabled: boolean
  sound_key: string
  message_sound_key: string
  email_sound_key: string
  payment_sound_key: string
  start_hour: number
  end_hour: number
  message_repeat_interval: number
  email_repeat_interval: number
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
  payment_sound_key: 'cascade',
  start_hour: 9,
  end_hour: 17,
  message_repeat_interval: 60,
  email_repeat_interval: 60,
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

function isWithinActiveHours(startHour: number, endHour: number): boolean {
  const hour = new Date().getHours()
  return startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour
}

export default function NotificationManager() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([])
  const [hasInteracted, setHasInteracted] = useState(false)

  // Separate interval refs for message and email timers
  const msgIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const emailIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Payment polling interval (checks frequently, but only plays once per new payment)
  const paymentIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Track last known unread payment count to detect new payments
  const lastPaymentCountRef = useRef<number>(-1)

  const settingsRef = useRef(settings)
  const customSoundsRef = useRef(customSounds)
  const hasInteractedRef = useRef(hasInteracted)
  settingsRef.current = settings
  customSoundsRef.current = customSounds
  hasInteractedRef.current = hasInteracted

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

  // --- Message alert check ---
  const checkMessages = useCallback(async () => {
    const s = settingsRef.current
    if (!s.sound_enabled || !hasInteractedRef.current) return
    if (!isWithinActiveHours(s.start_hour, s.end_hour)) return

    try {
      const res = await fetch('/api/messages/unread-count')
      const data = await res.json()
      if (data.count > 0) {
        const key = s.message_sound_key || s.sound_key || 'chime'
        playSoundByKey(key, customSoundsRef.current)
      }
    } catch { /* silently fail */ }
  }, [])

  // --- Email alert check ---
  const checkEmails = useCallback(async () => {
    const s = settingsRef.current
    if (!s.sound_enabled || !hasInteractedRef.current) return
    if (!isWithinActiveHours(s.start_hour, s.end_hour)) return

    try {
      const res = await fetch('/api/gmail/unread-count')
      const data = await res.json()
      if (data.count > 0) {
        const key = s.email_sound_key || 'bell'
        playSoundByKey(key, customSoundsRef.current)
      }
    } catch { /* silently fail */ }
  }, [])

  // --- Payment alert check (one-shot: only plays when count increases) ---
  const checkPayments = useCallback(async () => {
    const s = settingsRef.current
    if (!s.sound_enabled || !hasInteractedRef.current) return
    if (!isWithinActiveHours(s.start_hour, s.end_hour)) return

    try {
      const res = await fetch('/api/payments/unread-count')
      const data = await res.json()
      const currentCount = data.count || 0

      // First poll: just record the baseline, don't alert
      if (lastPaymentCountRef.current === -1) {
        lastPaymentCountRef.current = currentCount
        return
      }

      // Only play if count went UP (new payment arrived)
      if (currentCount > lastPaymentCountRef.current) {
        const key = s.payment_sound_key || 'cascade'
        playSoundByKey(key, customSoundsRef.current)
      }

      lastPaymentCountRef.current = currentCount
    } catch { /* silently fail */ }
  }, [])

  // --- Set up message repeating timer ---
  useEffect(() => {
    if (msgIntervalRef.current) clearInterval(msgIntervalRef.current)

    const initialTimeout = setTimeout(checkMessages, 5000)
    msgIntervalRef.current = setInterval(checkMessages, settings.message_repeat_interval * 1000)

    return () => {
      clearTimeout(initialTimeout)
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current)
    }
  }, [settings.message_repeat_interval, checkMessages])

  // --- Set up email repeating timer ---
  useEffect(() => {
    if (emailIntervalRef.current) clearInterval(emailIntervalRef.current)

    const initialTimeout = setTimeout(checkEmails, 7000) // stagger 2s after messages
    emailIntervalRef.current = setInterval(checkEmails, settings.email_repeat_interval * 1000)

    return () => {
      clearTimeout(initialTimeout)
      if (emailIntervalRef.current) clearInterval(emailIntervalRef.current)
    }
  }, [settings.email_repeat_interval, checkEmails])

  // --- Set up payment polling (fixed 30s, one-shot alert) ---
  useEffect(() => {
    if (paymentIntervalRef.current) clearInterval(paymentIntervalRef.current)

    const initialTimeout = setTimeout(checkPayments, 9000) // stagger 4s after messages
    paymentIntervalRef.current = setInterval(checkPayments, 30000) // poll every 30s

    return () => {
      clearTimeout(initialTimeout)
      if (paymentIntervalRef.current) clearInterval(paymentIntervalRef.current)
    }
  }, [checkPayments])

  // This component renders nothing visible
  return null
}
