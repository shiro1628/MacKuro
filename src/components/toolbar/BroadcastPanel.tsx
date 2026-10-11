import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useAppStore, type Workspace } from '../../store/useAppStore'
import { WORKING_WINDOW_MS } from '../../store/projectStore'
import { broadcastPrompt, useBroadcastStore, type DeliveryStatus } from '../../store/broadcast'

const panelClass = 'absolute right-0 top-full mt-2 z-50 w-[420px] max-h-[80vh] overflow-y-auto rounded-xl border border-surface-border bg-surface-1 p-3 shadow-2xl'

const btn = 'px-2 py-0.5 text-[11px] rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap'
const btnNeutral = `${btn} border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500`
const btnAccent = `${btn} border-accent/40 text-accent hover:bg-accent/10 active:bg-accent/20`

/** Re-render every second so "working" fades to idle without new output. */
function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function deliveryLabel(d: DeliveryStatus) {
  switch (d.kind) {
    case 'starting': return { text: 'Claude 시작 중…', cls: 'text-gray-400 animate-pulse' }
    case 'sent': return d.queued
      ? { text: '전송됨 · 작업 끝나면 처리', cls: 'text-accent' }
      : { text: '✓ 전송됨', cls: 'text-green-400' }
    case 'failed': return { text: d.reason, cls: 'text-red-300' }
  }
}

function ProjectRow({ workspace, checked, onToggle, now }: {
  workspace: Workspace; checked: boolean; onToggle: () => void; now: number
}) {
  const ready = useStore(workspace.store, s => s.ready)
  const claudeRunning = useStore(workspace.store, s => s.claudeRunning)
  const lastOutputAt = useStore(workspace.store, s => s.lastOutputAt)
  const delivery = useBroadcastStore(s => s.results[workspace.id])

  const working = claudeRunning && now - lastOutputAt < WORKING_WINDOW_MS
  const status =
    !workspace.visited ? { cls: 'idle', label: '미실행' }
    : !ready || (!claudeRunning && lastOutputAt === 0) ? { cls: 'loading', label: '시작 중' }
    : !claudeRunning ? { cls: 'idle', label: '종료됨' }
    : working ? { cls: 'loading', label: '작업 중' }
    : { cls: 'ready', label: '대기 중' }
  const result = delivery && deliveryLabel(delivery)

  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onToggle} className="accent-[#f0a500]" />
      <span className={`status-dot ${status.cls}`} />
      <span className="text-xs text-gray-200 truncate">{workspace.name}</span>
      <span className="text-[10px] text-gray-600 flex-shrink-0">{status.label}</span>
      <span className="flex-1" />
      {result && <span className={`text-[10px] truncate ${result.cls}`} title={result.text}>{result.text}</span>}
    </label>
  )
}

/** Compose one prompt and send it to the Claude terminal of every checked project. */
export default function BroadcastPanel() {
  const projects = useAppStore(s => s.projects)
  // Track exclusions so projects opened later start out selected.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const now = useNow()

  useEffect(() => { inputRef.current?.focus() }, [])

  const selected = projects.filter(p => !excluded.has(p.id))
  const allSelected = selected.length === projects.length
  const canSend = prompt.trim().length > 0 && selected.length > 0

  const toggle = (id: string) => setExcluded(prev => {
    const next = new Set(prev)
    if (!next.delete(id)) next.add(id)
    return next
  })

  const send = () => {
    if (!canSend) return
    broadcastPrompt(selected.map(p => p.id), prompt)
    setPrompt('')
  }

  return (
    <div className={panelClass}>
      <header className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-200">일괄 전송</span>
        <span className="text-[10px] text-gray-600">선택한 프로젝트의 Claude에 같은 프롬프트를 보냅니다</span>
      </header>

      <textarea
        ref={inputRef}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); send() }
        }}
        rows={4}
        placeholder="예: 테스트 돌리고 실패하면 고쳐줘"
        className="w-full resize-y rounded-md border border-surface-border bg-surface-2 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/50"
      />

      <div className="flex items-center gap-2 mt-2 mb-1">
        <button
          className={btnNeutral}
          onClick={() => setExcluded(allSelected ? new Set(projects.map(p => p.id)) : new Set())}
        >
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
        <span className="text-[10px] text-gray-600">{selected.length}/{projects.length}개 선택</span>
        <span className="flex-1" />
        <button className={btnAccent} disabled={!canSend} onClick={send} title="⌘Enter">
          {selected.length}개 프로젝트에 전송 ⌘↵
        </button>
      </div>

      <div className="flex flex-col">
        {projects.map(p => (
          <ProjectRow key={p.id} workspace={p} checked={!excluded.has(p.id)} onToggle={() => toggle(p.id)} now={now} />
        ))}
      </div>
    </div>
  )
}
