import { useCallback, useEffect, useState } from 'react'
import { logToActive } from '../../../store/useAppStore'

export type LocalAiStatus = Awaited<ReturnType<typeof window.kuro.localAiStatus>>

export interface PullProgress {
  status: string
  completed?: number
  total?: number
}

// The toolbar dots only need a slow heartbeat; the open panel shows live memory.
const IDLE_POLL_MS = 8000
const OPEN_POLL_MS = 2000

/** Ollama / ComfyUI / machine load, plus the actions the panel can take. */
export function useLocalAi(panelOpen: boolean) {
  const log = logToActive
  const [status, setStatus] = useState<LocalAiStatus | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [pulls, setPulls] = useState<Record<string, PullProgress>>({})

  const refresh = useCallback(() =>
    window.kuro.localAiStatus().then(setStatus).catch(() => undefined), [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, panelOpen ? OPEN_POLL_MS : IDLE_POLL_MS)
    return () => clearInterval(timer)
  }, [panelOpen, refresh])

  useEffect(() => window.kuro.onOllamaPullProgress(({ model, status, completed, total, done }) => {
    setPulls(prev => {
      const next = { ...prev }
      if (done) delete next[model]
      else next[model] = { status, completed, total: total ?? prev[model]?.total }
      return next
    })
  }), [])

  /** Runs one action at a time per key, logging the outcome to the console panel. */
  const run = useCallback(async (key: string, label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(prev => ({ ...prev, [key]: true }))
    try {
      const result = await fn()
      if (result.success) log('success', label)
      else log('error', `${label} 실패: ${result.error}`)
      return result.success
    } finally {
      setBusy(prev => { const next = { ...prev }; delete next[key]; return next })
      refresh()
    }
  }, [log, refresh])

  return { status, busy, pulls, run, refresh }
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}
