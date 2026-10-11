import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { closeProject, pickAndOpenProject, useAppStore, type Workspace } from '../../store/useAppStore'
import { WORKING_WINDOW_MS } from '../../store/projectStore'

const EXPANDED_WIDTH = 220
// Wide enough to keep the macOS traffic lights clear.
const COLLAPSED_WIDTH = 72

/** Stable per-path hue, so a project keeps its badge color across launches. */
function hueOf(path: string) {
  let h = 0
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0
  return h % 360
}

/** Re-render every second so "working" fades to idle without new output. */
function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export default function ProjectSidebar() {
  const projects = useAppStore(s => s.projects)
  const activeId = useAppStore(s => s.activeId)
  const collapsed = useAppStore(s => s.sidebarCollapsed)
  const toggleSidebar = useAppStore(s => s.toggleSidebar)
  const setActive = useAppStore(s => s.setActive)
  const moveProject = useAppStore(s => s.moveProject)
  const now = useNow()
  const [dragId, setDragId] = useState<string | null>(null)

  return (
    <aside
      className="flex flex-col flex-shrink-0 bg-surface-1 border-r border-surface-border transition-[width] duration-150"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, borderRightColor: '#1a1a1a' }}
    >
      {/* Traffic-light strip doubles as the window drag handle */}
      <div className="titlebar-drag h-11 flex-shrink-0 flex items-end px-3 pb-1">
        {!collapsed && (
          <span className="ml-auto text-[10px] tracking-widest uppercase text-gray-700 select-none">
            Projects
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {projects.map((ws, i) => (
          <ProjectItem
            key={ws.id}
            workspace={ws}
            index={i}
            active={ws.id === activeId}
            collapsed={collapsed}
            now={now}
            dragging={dragId === ws.id}
            onSelect={() => setActive(ws.id)}
            onClose={() => closeProject(ws.id)}
            onDragStart={() => setDragId(ws.id)}
            onDragEnd={() => setDragId(null)}
            onDropOn={() => { if (dragId && dragId !== ws.id) moveProject(dragId, i) }}
          />
        ))}
      </div>

      <div className={`flex-shrink-0 border-t border-surface-border p-2 flex gap-1 ${collapsed ? 'flex-col items-center' : 'items-center'}`}>
        <button
          onClick={() => pickAndOpenProject()}
          title="프로젝트 열기 (⌘O)"
          className={`flex items-center justify-center gap-1.5 h-7 rounded text-xs text-gray-500 hover:text-accent hover:bg-surface-2 transition-colors ${collapsed ? 'w-8' : 'flex-1'}`}
        >
          <span className="text-sm leading-none">+</span>
          {!collapsed && '프로젝트 열기'}
        </button>
        <button
          onClick={toggleSidebar}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="w-8 h-7 flex items-center justify-center rounded text-xs text-gray-600 hover:text-gray-300 hover:bg-surface-2 transition-colors"
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
    </aside>
  )
}

interface ItemProps {
  workspace: Workspace
  index: number
  active: boolean
  collapsed: boolean
  now: number
  dragging: boolean
  onSelect: () => void
  onClose: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDropOn: () => void
}

function ProjectItem({
  workspace, index, active, collapsed, now, dragging,
  onSelect, onClose, onDragStart, onDragEnd, onDropOn,
}: ItemProps) {
  const ready = useStore(workspace.store, s => s.ready)
  const claudeRunning = useStore(workspace.store, s => s.claudeRunning)
  const lastOutputAt = useStore(workspace.store, s => s.lastOutputAt)
  const unread = useStore(workspace.store, s => s.unread)
  const codexBusy = useStore(workspace.store, s => !!s.activeCodexId)

  const working = claudeRunning && now - lastOutputAt < WORKING_WINDOW_MS
  const status =
    !workspace.visited ? { cls: 'idle', label: '아직 열지 않음' }
    : !ready ? { cls: 'loading', label: '준비 중' }
    : !claudeRunning ? { cls: 'idle', label: 'Claude 종료됨' }
    : working ? { cls: 'loading', label: 'Claude 작업 중' }
    : unread ? { cls: 'running', label: '새 출력 있음' }
    : { cls: 'ready', label: 'Claude 대기 중' }

  const hue = hueOf(workspace.path)
  const parent = workspace.path.split('/').slice(-2, -1)[0] ?? ''
  const shortcut = index < 9 ? `⌘${index + 1}` : ''
  const tooltip = `${workspace.path}\n${status.label}${codexBusy ? ' · Codex 실행 중' : ''}${shortcut ? `\n${shortcut}` : ''}`

  return (
    <div
      role="button"
      draggable
      onClick={onSelect}
      onAuxClick={e => { if (e.button === 1) onClose() }}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onDropOn() }}
      title={tooltip}
      className={`group relative flex items-center gap-2.5 mx-2 my-0.5 rounded-md cursor-default select-none transition-colors ${
        collapsed ? 'justify-center py-1.5' : 'px-2 py-1.5'
      } ${active ? 'bg-surface-3' : 'hover:bg-surface-2'} ${dragging ? 'opacity-40' : ''}`}
    >
      {active && <span className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />}

      {/* Badge with status dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold uppercase"
          style={{
            background: `hsl(${hue} 35% ${active ? 22 : 15}%)`,
            color: `hsl(${hue} 70% ${active ? 78 : 62}%)`,
          }}
        >
          {workspace.name.slice(0, 1)}
        </div>
        <span
          className={`status-dot ${status.cls === 'ready' ? '' : status.cls} absolute -right-0.5 -bottom-0.5`}
          style={{
            width: 8, height: 8,
            border: '1.5px solid #111',
            ...(status.cls === 'ready' ? { background: '#4ade80' } : {}),
          }}
        />
      </div>

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className={`text-xs truncate ${active ? 'text-gray-100' : 'text-gray-400'}`}>
            {workspace.name}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-700 truncate">
            {codexBusy && <span className="text-gem">codex ·</span>}
            <span className="truncate">{parent && `${parent}/`}</span>
          </div>
        </div>
      )}

      {!collapsed && (
        <>
          <span className="text-[10px] text-gray-700 font-mono group-hover:hidden">{shortcut}</span>
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            title="프로젝트 닫기 (⌘⇧W)"
            className="hidden group-hover:flex w-5 h-5 items-center justify-center rounded text-gray-600 hover:text-gray-200 hover:bg-surface-border"
          >
            ×
          </button>
        </>
      )}
    </div>
  )
}
