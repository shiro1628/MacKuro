import { create } from 'zustand'
import { WORKING_WINDOW_MS, type ProjectState, type ProjectStore } from './projectStore'
import { useAppStore, type Workspace } from './useAppStore'

// Claude's TUI prints its banner in bursts; this much silence means the prompt is up.
const SETTLE_MS = 1500
const START_TIMEOUT_MS = 30_000

export type DeliveryStatus =
  | { kind: 'starting' }
  | { kind: 'sent'; queued: boolean }
  | { kind: 'failed'; reason: string }

interface BroadcastStore {
  /** Delivery state of the latest broadcast, by project id. */
  results: Record<string, DeliveryStatus>
  setResult: (id: string, status: DeliveryStatus) => void
  clear: () => void
}

export const useBroadcastStore = create<BroadcastStore>(set => ({
  results: {},
  setResult: (id, status) => set(s => ({ results: { ...s.results, [id]: status } })),
  clear: () => set({ results: {} }),
}))

/** Resolve once `test` holds for the store's state, or with false after the timeout. */
function waitFor(store: ProjectStore, test: (s: ProjectState) => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let poll: ReturnType<typeof setInterval> | undefined
    let unsub = () => {}
    const finish = (ok: boolean) => {
      clearTimeout(timer)
      clearInterval(poll)
      unsub()
      resolve(ok)
    }
    const check = () => { if (test(store.getState())) finish(true) }
    timer = setTimeout(() => finish(false), timeoutMs)
    unsub = store.subscribe(check)
    // Silence produces no state change, so time-based conditions need a poll too.
    poll = setInterval(check, 250)
    check()
  })
}

/** Start a never-opened project's Claude in the background and wait until its prompt is up. */
async function ensureClaude(ws: Workspace): Promise<string | null> {
  const store = ws.store
  const { claudeRunning, lastOutputAt } = store.getState()
  if (claudeRunning && lastOutputAt > 0) return null
  if (ws.visited && !claudeRunning && lastOutputAt > 0) return 'Claude 종료됨 — ↺로 재시작하세요'

  useBroadcastStore.getState().setResult(ws.id, { kind: 'starting' })
  useAppStore.getState().markVisited(ws.id)
  const up = await waitFor(store, s => s.claudeRunning && s.lastOutputAt > 0
    && Date.now() - s.lastOutputAt > SETTLE_MS, START_TIMEOUT_MS)
  return up ? null : 'Claude 시작 시간 초과'
}

async function deliver(ws: Workspace, prompt: string) {
  const { setResult } = useBroadcastStore.getState()
  const error = await ensureClaude(ws)
  // The project may have been closed while Claude was starting.
  if (!useAppStore.getState().projects.some(p => p.id === ws.id)) return
  if (error) {
    setResult(ws.id, { kind: 'failed', reason: error })
    return
  }
  const s = ws.store.getState()
  const queued = Date.now() - s.lastOutputAt < WORKING_WINDOW_MS
  // Bracketed paste keeps inner newlines from submitting early.
  window.kuro.ptyWrite(s.claudePtyId, `\x1b[200~${prompt}\x1b[201~\r`)
  s.log('info', `일괄 전송: ${prompt.split('\n')[0].slice(0, 60)}`)
  setResult(ws.id, { kind: 'sent', queued })
}

/** Send one prompt to the Claude terminal of each given project. */
export function broadcastPrompt(projectIds: string[], prompt: string) {
  const text = prompt.trim()
  if (!text) return
  useBroadcastStore.getState().clear()
  const targets = useAppStore.getState().projects.filter(p => projectIds.includes(p.id))
  for (const ws of targets) deliver(ws, text)
}
