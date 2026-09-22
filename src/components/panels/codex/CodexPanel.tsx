import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import CodexComposer from './CodexComposer'
import CodexHeader from './CodexHeader'
import EntryCard from './EntryCard'
import WorktreeBar from './WorktreeBar'
import { useAutoReview } from './hooks/useAutoReview'
import { useCodexRun } from './hooks/useCodexRun'
import { useCodexStream } from './hooks/useCodexStream'
import { useWorktree } from './hooks/useWorktree'
import type { Mode } from './types'

export default function CodexPanel() {
  const entries = useAppStore(s => s.codexEntries)
  const activeId = useAppStore(s => s.activeCodexId)
  const project = useAppStore(s => s.project)
  const log = useAppStore(s => s.log)
  const pendingCodexInput = useAppStore(s => s.pendingCodexInput)
  const setPendingCodexInput = useAppStore(s => s.setPendingCodexInput)

  const [mode, setMode] = useState<Mode>('review')
  const [input, setInput] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [autoReview, setAutoReview] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const { runReview, runPrompt } = useCodexRun()
  const { worktree, create: createWorktree } = useWorktree(project?.path)

  useCodexStream(activeId)
  useAutoReview({ projectPath: project?.path, enabled: autoReview, activeId, runReview })

  // Code sent over from a terminal selection lands in the composer.
  useEffect(() => {
    if (!pendingCodexInput) return
    setInput(prev => prev ? prev + '\n\n' + pendingCodexInput : pendingCodexInput)
    setPendingCodexInput(null)
  }, [pendingCodexInput])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [entries])

  // Load the diff into the composer so it can be edited before sending.
  const handleDiffReview = async () => {
    if (!project || diffLoading || !!activeId) return
    setDiffLoading(true)
    try {
      const { diff, empty } = await window.kuro.gitDiff(project.path)
      if (empty) {
        log('warn', 'git diff: 변경사항 없음')
        return
      }
      setMode('review')
      setInput(`아래 git diff를 코드 리뷰해줘. 버그, 보안 이슈, 개선점 위주로.\n\n${diff}`)
    } finally {
      setDiffLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || activeId) return

    setInput('')
    if (mode === 'review') await runReview(trimmed)
    else await runPrompt(mode, trimmed)
  }

  return (
    <div className="panel h-full">
      <CodexHeader
        busy={!!activeId}
        autoReview={autoReview}
        onToggleAutoReview={() => setAutoReview(v => !v)}
        diffDisabled={!project || diffLoading || !!activeId}
        diffLoading={diffLoading}
        onDiffReview={handleDiffReview}
      />

      <WorktreeBar worktree={worktree} onCreate={createWorktree} />

      {/* Entry list */}
      <div ref={listRef} className="flex-1 overflow-y-auto py-2 min-h-0">
        {entries.length === 0 ? (
          <p className="text-center text-gray-700 text-xs py-8">
            아래에서 리뷰 또는 리서치 요청을 입력하세요
          </p>
        ) : (
          entries.map(e => <EntryCard key={e.id} entry={e} />)
        )}
      </div>

      <CodexComposer
        mode={mode}
        onModeChange={setMode}
        input={input}
        onInputChange={setInput}
        disabled={!!activeId}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
