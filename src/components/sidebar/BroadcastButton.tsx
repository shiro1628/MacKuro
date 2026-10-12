import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import BroadcastPanel from './BroadcastPanel'

/** Project-bar entry for sending one prompt to many projects; also opened with ⌘⇧Enter. */
export default function BroadcastButton({ collapsed }: { collapsed: boolean }) {
  const open = useAppStore(s => s.broadcastOpen)
  const setOpen = useAppStore(s => s.setBroadcastOpen)
  const projectCount = useAppStore(s => s.projects.length)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-center gap-1.5 h-7 rounded text-xs transition-colors active:scale-95 ${
          collapsed ? 'w-8' : 'px-2'
        } ${open ? 'text-accent bg-accent/10' : 'text-gray-500 hover:text-accent hover:bg-surface-2'}`}
        title={`열린 프로젝트 ${projectCount}개에 프롬프트 일괄 전송 (⌘⇧↵)`}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
        {!collapsed && '일괄'}
      </button>

      {open && <BroadcastPanel />}
    </div>
  )
}
