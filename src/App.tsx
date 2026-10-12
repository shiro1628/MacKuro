import { useEffect } from 'react'
import { useStore } from 'zustand'
import { closeProject, openProject, pickAndOpenProject, useAppStore, type Workspace } from './store/useAppStore'
import { ProjectContext } from './store/projectStore'
import MainLayout from './components/layout/MainLayout'
import ProjectLoadScreen from './components/ProjectLoadScreen'
import ProjectSidebar from './components/sidebar/ProjectSidebar'
import Toolbar from './components/toolbar/Toolbar'

export default function App() {
  const projects = useAppStore(s => s.projects)
  const activeId = useAppStore(s => s.activeId)
  const sidebarHidden = useAppStore(s => s.sidebarHidden)
  const active = projects.find(p => p.id === activeId)

  // ⌘1…⌘9 switch projects, ⌘O opens one, ⌘⇧W closes the current one, ⌘B shows/hides the sidebar,
  // ⌘⇧Enter opens the broadcast panel.
  // Capture phase so the focused xterm never sees these keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey || e.altKey) return
      const { projects, activeId, setActive } = useAppStore.getState()
      let handled = true
      if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
        const target = projects[Number(e.key) - 1]
        if (target) setActive(target.id)
      } else if (e.key === 'o' && !e.shiftKey) {
        pickAndOpenProject()
      } else if (e.key === 'w' && e.shiftKey && activeId) {
        closeProject(activeId)
      } else if (e.key === 'b' && !e.shiftKey) {
        useAppStore.getState().toggleSidebarHidden()
      } else if (e.key === 'Enter' && e.shiftKey) {
        const { broadcastOpen, setBroadcastOpen, sidebarHidden, toggleSidebarHidden } = useAppStore.getState()
        // The button lives in the project bar, so reveal it before opening the panel.
        if (!broadcastOpen && sidebarHidden) toggleSidebarHidden()
        setBroadcastOpen(!broadcastOpen)
      } else {
        handled = false
      }
      if (handled) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (projects.length === 0) {
    return <ProjectLoadScreen onOpen={path => openProject(path)} />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!sidebarHidden && <ProjectSidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        {active && (
          <ProjectContext.Provider value={active.store}>
            <Toolbar />
          </ProjectContext.Provider>
        )}
        {/* Every visited project stays mounted so its terminals keep running; only the active one shows. */}
        <div className="relative flex-1 min-h-0">
          {projects.filter(p => p.visited).map(p => (
            <ProjectView key={p.id} workspace={p} active={p.id === activeId} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProjectView({ workspace, active }: { workspace: Workspace; active: boolean }) {
  const ready = useStore(workspace.store, s => s.ready)
  return (
    <div className="absolute inset-0 flex flex-col" style={{ display: active ? 'flex' : 'none' }}>
      <ProjectContext.Provider value={workspace.store}>
        {ready ? <MainLayout /> : (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-600">
            {workspace.name} 준비 중…
          </div>
        )}
      </ProjectContext.Provider>
    </div>
  )
}
