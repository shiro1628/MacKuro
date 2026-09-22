import { create } from 'zustand'

// Entries can hold a whole diff, so keep far fewer of them than console lines.
const MAX_CODEX_ENTRIES = 50
const MAX_CONSOLE_ENTRIES = 500

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

interface AppStore {
  project: { path: string; name: string } | null
  devServerCommand: { name: string; script: string } | null
  claudeRunning: boolean
  devServerRunning: boolean
  autoSnippet: boolean       // 코드 붙여넣기 자동 snippet 래핑

  codexEntries: CodexEntry[]
  activeCodexId: string | null

  consoleEntries: ConsoleEntry[]

  setProject: (path: string) => void
  clearProject: () => void
  setDevServerCommand: (cmd: { name: string; script: string } | null) => void
  setClaudeRunning: (v: boolean) => void
  setDevServerRunning: (v: boolean) => void
  toggleAutoSnippet: () => void

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

export const useAppStore = create<AppStore>((set, get) => ({
  project: null,
  devServerCommand: null,
  claudeRunning: false,
  devServerRunning: false,
  autoSnippet: true,
  codexEntries: [],
  activeCodexId: null,
  pendingCodexInput: null,
  claudeRestartSignal: 0,
  restartClaude: () => set(s => ({ claudeRestartSignal: s.claudeRestartSignal + 1 })),
  consoleEntries: [],

  setProject: (path) => {
    const name = path.split(/[\\/]/).pop() ?? path
    set({ project: { path, name } })
  },
  clearProject: () => set({ project: null, devServerCommand: null, claudeRunning: false, devServerRunning: false }),
  setDevServerCommand: (cmd) => set({ devServerCommand: cmd }),
  setClaudeRunning: (v) => set({ claudeRunning: v }),
  setDevServerRunning: (v) => set({ devServerRunning: v }),
  toggleAutoSnippet: () => set(s => ({ autoSnippet: !s.autoSnippet })),

  setPendingCodexInput: (text) => set({ pendingCodexInput: text }),

  addCodexEntry: (entry) => {
    const id = crypto.randomUUID()
    set(s => ({
      codexEntries: [...s.codexEntries.slice(-(MAX_CODEX_ENTRIES - 1)), { ...entry, id, timestamp: new Date() }],
      activeCodexId: id,
    }))
    return id
  },
  appendCodexChunk: (id, chunk) => {
    set(s => ({
      codexEntries: s.codexEntries.map(e =>
        e.id === id ? { ...e, output: e.output + chunk } : e
      ),
    }))
  },
  finishCodexEntry: (id) => {
    set(s => ({
      codexEntries: s.codexEntries.map(e =>
        e.id === id ? { ...e, loading: false } : e
      ),
      activeCodexId: null,
    }))
  },
  failCodexEntry: (id, error) => {
    set(s => ({
      codexEntries: s.codexEntries.map(e =>
        e.id === id ? { ...e, loading: false, error } : e
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
