import { create } from 'zustand'

// Saved prompts and the send log for the broadcast panel, kept across launches.

const PRESETS_KEY = 'mackuro.broadcast.presets'
const HISTORY_KEY = 'mackuro.broadcast.history'
const HISTORY_LIMIT = 30

export interface BroadcastPreset {
  id: string
  name: string
  prompt: string
}

export type HistoryOutcome = 'pending' | 'sent' | 'queued' | 'failed'

export interface HistoryTarget {
  path: string
  name: string
  outcome: HistoryOutcome
  reason?: string
}

export interface HistoryEntry {
  id: string
  at: number
  prompt: string
  targets: HistoryTarget[]
}

interface LibraryStore {
  presets: BroadcastPreset[]
  history: HistoryEntry[]
  addPreset: (name: string, prompt: string) => void
  updatePreset: (id: string, patch: Partial<Omit<BroadcastPreset, 'id'>>) => void
  removePreset: (id: string) => void
  /** Log a broadcast; returns the entry id so deliveries can report back. */
  logBroadcast: (prompt: string, targets: { path: string; name: string }[]) => string
  setOutcome: (entryId: string, path: string, outcome: HistoryOutcome, reason?: string) => void
  removeHistory: (id: string) => void
  clearHistory: () => void
}

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** First line of a prompt, trimmed for use as a default preset name. */
export function summarize(prompt: string, max = 24) {
  const line = prompt.trim().split('\n')[0]
  return line.length > max ? `${line.slice(0, max)}…` : line
}

export const useBroadcastLibrary = create<LibraryStore>(set => ({
  presets: load(PRESETS_KEY, []),
  history: load(HISTORY_KEY, []),

  addPreset: (name, prompt) => set(s => ({
    presets: [...s.presets, { id: newId(), name: name.trim() || summarize(prompt), prompt: prompt.trim() }],
  })),
  updatePreset: (id, patch) => set(s => ({
    presets: s.presets.map(p => p.id === id ? { ...p, ...patch } : p),
  })),
  removePreset: id => set(s => ({ presets: s.presets.filter(p => p.id !== id) })),

  logBroadcast: (prompt, targets) => {
    const entry: HistoryEntry = {
      id: newId(),
      at: Date.now(),
      prompt,
      targets: targets.map(t => ({ ...t, outcome: 'pending' })),
    }
    set(s => ({ history: [entry, ...s.history].slice(0, HISTORY_LIMIT) }))
    return entry.id
  },
  setOutcome: (entryId, path, outcome, reason) => set(s => ({
    history: s.history.map(e => e.id !== entryId ? e : {
      ...e,
      targets: e.targets.map(t => t.path === path ? { ...t, outcome, reason } : t),
    }),
  })),
  removeHistory: id => set(s => ({ history: s.history.filter(e => e.id !== id) })),
  clearHistory: () => set({ history: [] }),
}))

useBroadcastLibrary.subscribe(s => {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(s.presets))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(s.history))
  } catch {}
})
