import { useState } from 'react'
import type { WorktreeStatus } from './types'

interface Props {
  worktree: WorktreeStatus | null
  onCreate: () => void
}

const MAX_VISIBLE_FILES = 8

export default function WorktreeBar({ worktree, onCreate }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-b border-surface-border bg-surface-1/80 flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-gray-500">
        <button onClick={() => setOpen(v => !v)} className="titlebar-nodrag flex min-w-0 flex-1 items-center gap-2 text-left hover:text-gray-300">
          <span className="text-accent">◈</span>
          <span className="uppercase tracking-widest">Worktree</span>
          <span className="font-mono text-gray-600 truncate">{worktree?.branch || 'git 확인 중…'}</span>
          <span className="ml-auto">{worktree?.summary ?? '—'} {open ? '⌃' : '⌄'}</span>
        </button>
        <button
          onClick={onCreate}
          className="titlebar-nodrag rounded border border-accent/30 px-1.5 py-0.5 text-accent hover:bg-accent/10"
          title="새 브랜치 Worktree 생성"
        >+ 새 Worktree</button>
      </div>
      {open && (
        <div className="px-3 pb-2 max-h-20 overflow-y-auto text-[10px] font-mono">
          {worktree?.files.length ? worktree.files.slice(0, MAX_VISIBLE_FILES).map((file, index) => (
            <div key={`${file.path}-${index}`} className="flex gap-2 leading-4 text-gray-500">
              <span className={file.code.includes('?') ? 'text-green-400' : 'text-accent'}>{file.code}</span>
              <span className="truncate">{file.path}</span>
            </div>
          )) : <span className="text-gray-700">커밋하지 않은 변경사항이 여기에 표시됩니다.</span>}
        </div>
      )}
    </div>
  )
}
