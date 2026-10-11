import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'

// Entries can hold a whole diff, so keep far fewer of them than console lines.
const MAX_CODEX_ENTRIES = 50
const MAX_CONSOLE_ENTRIES = 500
// Claude's spinner prints constantly while it works; this much silence means it stopped.
export const WORKING_WINDOW_MS = 2500

export interface CodexEntry {
  id: string
  mode: 'review' | 'plan' | 'research'
  input: string
  output: string
  timestamp: Date
  loading: boolean
  error?: string
}

export interface ConsoleEntry {
  id: string
  timestamp: Date
  type: 'info' | 'success' | 'error' | 'warn'
  message: string
}

/** Everything that belongs to one open project. Each project gets its own store. */
export interface ProjectState {
  id: string
  project: { path: string; name: string }
  /** PTY id of this project's Claude terminal; PTY ids are global, so namespace them. */
  claudePtyId: string
  /** MCP inject + dev server detection finished; panels may mount. */
  ready: boolean

  devServerCommand: { name: string; script: string } | null
  claudeRunning: boolean
  devServerRunning: boolean
  /** Last time the Claude terminal printed anything — drives the sidebar "working" dot. */
  lastOutputAt: number
  /** Claude printed something while this project was in the background. */
  unread: boolean

  codexEntries: CodexEntry[]
  activeCodexId: string | null

  consoleEntries: ConsoleEntry[]

  setDevServerCommand: (cmd: { name: string; script: string } | null) => void
  setClaudeRunning: (v: boolean) => void
  setDevServerRunning: (v: boolean) => void

  pendingCodexInput: string | null
  setPendingCodexInput: (text: string | null) => void

  claudeRestartSignal: number   // 값이 바뀔 때마다 ClaudePanel이 재시작
  restartClaude: () => void

  addCodexEntry: (entry: Omit<CodexEntry, 'id' | 'timestamp'>) => string
  appendCodexChunk: (id: string, chunk: string) => void
  finishCodexEntry: (id: string) => void
  failCodexEntry: (id: string, error: string) => void

  log: (type: ConsoleEntry['type'], message: string) => void
}

export type ProjectStore = StoreApi<ProjectState>

export function createProjectStore(id: string, path: string): ProjectStore {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path
  return createStore<ProjectState>((set) => ({
    id,
    project: { path, name },
    claudePtyId: `${id}:claude`,
    ready: false,
    devServerCommand: null,
    claudeRunning: false,
    devServerRunning: false,
    lastOutputAt: 0,
    unread: false,
    codexEntries: [],
    activeCodexId: null,
    pendingCodexInput: null,
    claudeRestartSignal: 0,
    restartClaude: () => set(s => ({ claudeRestartSignal: s.claudeRestartSignal + 1 })),
    consoleEntries: [],

    setDevServerCommand: (cmd) => set({ devServerCommand: cmd }),
    setClaudeRunning: (v) => set({ claudeRunning: v }),
    setDevServerRunning: (v) => set({ devServerRunning: v }),

    setPendingCodexInput: (text) => set({ pendingCodexInput: text }),

    addCodexEntry: (entry) => {
      const entryId = crypto.randomUUID()
      set(s => ({
        codexEntries: [...s.codexEntries.slice(-(MAX_CODEX_ENTRIES - 1)), { ...entry, id: entryId, timestamp: new Date() }],
        activeCodexId: entryId,
      }))
      return entryId
    },
    appendCodexChunk: (entryId, chunk) => {
      set(s => ({
        codexEntries: s.codexEntries.map(e =>
          e.id === entryId ? { ...e, output: e.output + chunk } : e
        ),
      }))
    },
    finishCodexEntry: (entryId) => {
      set(s => ({
        codexEntries: s.codexEntries.map(e =>
          e.id === entryId ? { ...e, loading: false } : e
        ),
        activeCodexId: null,
      }))
    },
    failCodexEntry: (entryId, error) => {
      set(s => ({
        codexEntries: s.codexEntries.map(e =>
          e.id === entryId ? { ...e, loading: false, error } : e
        ),
        activeCodexId: null,
      }))
    },

    log: (type, message) => {
      const entry: ConsoleEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type,
        message,
      }
      set(s => ({ consoleEntries: [...s.consoleEntries.slice(-(MAX_CONSOLE_ENTRIES - 1)), entry] }))
    },
  }))
}

export const ProjectContext = createContext<ProjectStore | null>(null)

/** The store of the project the calling component was rendered for. */
export function useProjectStoreApi(): ProjectStore {
  const store = useContext(ProjectContext)
  if (!store) throw new Error('useProjectStore must be used inside a ProjectContext provider')
  return store
}

export function useProjectStore<T>(selector: (s: ProjectState) => T): T {
  return useStore(useProjectStoreApi(), selector)
}
