import { create } from 'zustand'
import { createProjectStore, type ConsoleEntry, type ProjectStore } from './projectStore'

export type { CodexEntry, ConsoleEntry } from './projectStore'

const PERSIST_KEY = 'mackuro.workspace'

export interface Workspace {
  id: string
  path: string
  name: string
  store: ProjectStore
  /** Panels (and so the Claude PTY) mount on first activation, not on restore. */
  visited: boolean
}

interface AppStore {
  projects: Workspace[]
  activeId: string | null
  sidebarCollapsed: boolean
  /** Sidebar fully hidden (⌘B), as opposed to collapsed to the icon rail. */
  sidebarHidden: boolean
  autoSnippet: boolean       // 코드 붙여넣기 자동 snippet 래핑

  addProject: (path: string, activate: boolean) => Workspace
  setActive: (id: string) => void
  removeProject: (id: string) => void
  moveProject: (id: string, toIndex: number) => void
  toggleSidebar: () => void
  toggleSidebarHidden: () => void
  toggleAutoSnippet: () => void
}

let nextId = 0

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  activeId: null,
  sidebarCollapsed: false,
  sidebarHidden: false,
  autoSnippet: true,

  addProject: (path, activate) => {
    const id = `p${++nextId}`
    const store = createProjectStore(id, path)
    const ws: Workspace = { id, path, name: store.getState().project.name, store, visited: false }
    set(s => ({ projects: [...s.projects, ws] }))
    if (activate || !get().activeId) get().setActive(id)
    return ws
  },
  setActive: (id) => {
    const ws = get().projects.find(p => p.id === id)
    if (!ws) return
    ws.store.setState({ unread: false })
    set(s => ({
      activeId: id,
      projects: ws.visited ? s.projects : s.projects.map(p => p.id === id ? { ...p, visited: true } : p),
    }))
  },
  removeProject: (id) => {
    const { projects, activeId } = get()
    const index = projects.findIndex(p => p.id === id)
    if (index < 0) return
    const next = projects.filter(p => p.id !== id)
    set({ projects: next })
    if (activeId === id) {
      const neighbor = next[Math.min(index, next.length - 1)]
      if (neighbor) get().setActive(neighbor.id)
      else set({ activeId: null })
    }
  },
  moveProject: (id, toIndex) => {
    const projects = [...get().projects]
    const from = projects.findIndex(p => p.id === id)
    if (from < 0) return
    const [ws] = projects.splice(from, 1)
    projects.splice(Math.max(0, Math.min(toIndex, projects.length)), 0, ws)
    set({ projects })
  },
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleSidebarHidden: () => set(s => ({ sidebarHidden: !s.sidebarHidden })),
  toggleAutoSnippet: () => set(s => ({ autoSnippet: !s.autoSnippet })),
}))

export function activeWorkspace(): Workspace | undefined {
  const { projects, activeId } = useAppStore.getState()
  return projects.find(p => p.id === activeId)
}

/** For app-wide events (HTTP server, browser, local AI): log to whichever project is in front. */
export function logToActive(type: ConsoleEntry['type'], message: string) {
  activeWorkspace()?.store.getState().log(type, message)
}

/**
 * Open a project in a new sidebar slot, or bring it forward if it is already
 * open. MCP inject and dev server detection finish before the panels mount so
 * Claude starts with the config already written.
 */
export async function openProject(path: string, activate = true) {
  const { projects, setActive, addProject } = useAppStore.getState()
  const existing = projects.find(p => p.path === path)
  if (existing) {
    if (activate) setActive(existing.id)
    return
  }

  const ws = addProject(path, activate)
  const { setDevServerCommand, log } = ws.store.getState()
  const [cmd, mcpResult] = await Promise.all([
    window.kuro.devserverDetect(path),
    window.kuro.mcpInject(path),
  ])

  setDevServerCommand(cmd)
  if (mcpResult.success) {
    log('success', `Playwright MCP configured → ${path}`)
  } else {
    log('warn', `MCP inject failed: ${mcpResult.error}`)
  }
  ws.store.setState({ ready: true })
}

export async function pickAndOpenProject() {
  const path = await window.kuro.openFolder()
  if (path) await openProject(path)
}

/** Close a project: its panels unmount (dev server panes kill their PTYs) and Claude is killed here. */
export async function closeProject(id: string) {
  const ws = useAppStore.getState().projects.find(p => p.id === id)
  if (!ws) return
  if (ws.store.getState().claudeRunning
    && !window.confirm(`${ws.name}을(를) 닫을까요? 실행 중인 Claude 세션과 터미널이 종료됩니다.`)) return
  useAppStore.getState().removeProject(id)
  await window.kuro.ptyKill(ws.store.getState().claudePtyId)
  if (useAppStore.getState().projects.length === 0) {
    const browser = await window.kuro.browserStatus()
    if (browser.running) await window.kuro.browserStop({ projectPath: ws.path })
  }
}

// ── Persistence: reopen the same projects (and sidebar state) next launch ──

interface Persisted { paths: string[]; active: string | null; collapsed: boolean; hidden?: boolean }

export function restoreWorkspace() {
  let saved: Persisted | null = null
  try { saved = JSON.parse(localStorage.getItem(PERSIST_KEY) ?? 'null') } catch {}
  if (saved) {
    useAppStore.setState({ sidebarCollapsed: !!saved.collapsed, sidebarHidden: !!saved.hidden })
    for (const path of saved.paths ?? []) openProject(path, false)
    const active = useAppStore.getState().projects.find(p => p.path === saved!.active)
    if (active) useAppStore.getState().setActive(active.id)
  }

  useAppStore.subscribe(s => {
    const data: Persisted = {
      paths: s.projects.map(p => p.path),
      active: s.projects.find(p => p.id === s.activeId)?.path ?? null,
      collapsed: s.sidebarCollapsed,
      hidden: s.sidebarHidden,
    }
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(data)) } catch {}
  })
}
