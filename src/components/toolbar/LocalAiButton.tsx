import { useEffect, useRef, useState } from 'react'
import LocalAiPanel from './LocalAiPanel'
import { useLocalAi } from './hooks/useLocalAi'

/** Toolbar entry for the local model servers; opens the management panel. */
export default function LocalAiButton() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const localAi = useLocalAi(open)
  const { status } = localAi

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

  const ollamaOn = !!status?.ollama.running
  const comfyOn = !!status?.comfy.running
  const loaded = status?.ollama.loaded.length ?? 0
  const title = [
    `Ollama: ${ollamaOn ? `실행 중${loaded ? ` · 로드된 모델 ${loaded}개` : ''}` : '중지'}`,
    `ComfyUI: ${comfyOn ? '실행 중' : '중지'}`,
    '클릭하여 로컬 AI 관리',
  ].join('\n')

  return (
    <div ref={rootRef} className="titlebar-nodrag relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`mac-toolbar-button flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md border transition-all duration-150 ${
          open || ollamaOn || comfyOn
            ? 'text-accent border-accent/40 bg-accent/8'
            : 'text-gray-600 border-surface-border hover:text-gray-400'
        }`}
        title={title}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
        </svg>
        Local AI
        <span className={`status-dot ${ollamaOn ? 'running' : 'idle'}`} style={{ width: 5, height: 5 }} />
        <span className={`status-dot ${comfyOn ? 'running' : 'idle'}`} style={{ width: 5, height: 5 }} />
      </button>

      {open && <LocalAiPanel {...localAi} />}
    </div>
  )
}
