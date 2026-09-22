interface Props {
  busy: boolean
  autoReview: boolean
  onToggleAutoReview: () => void
  diffDisabled: boolean
  diffLoading: boolean
  onDiffReview: () => void
}

export default function CodexHeader({ busy, autoReview, onToggleAutoReview, diffDisabled, diffLoading, onDiffReview }: Props) {
  return (
    <div className="panel-header">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        className={busy ? 'text-accent animate-tail-wag' : 'text-gray-700'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      Codex
      <span className="font-normal normal-case text-xs" style={{ color: '#555' }}>감시 / 리뷰</span>
      <button
        onClick={onToggleAutoReview}
        className={`ml-1 px-1.5 py-0.5 rounded border text-[10px] font-normal normal-case transition-colors ${autoReview ? 'text-green-400 border-green-800/50 bg-green-900/10' : 'text-gray-600 border-surface-border'}`}
        title="worktree 변경이 안정되면 Codex 자동 리뷰"
      >{autoReview ? '자동 리뷰 ON' : '자동 리뷰 OFF'}</button>
      <button
        onClick={onDiffReview}
        disabled={diffDisabled}
        className="ml-auto flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-purple-800/50 text-purple-400 hover:bg-purple-900/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-normal normal-case"
        title="git diff를 가져와서 Codex 리뷰 요청"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {diffLoading ? '로딩…' : '변경사항 리뷰'}
      </button>
      {busy && (
        <span className="ml-2 text-xs font-normal normal-case animate-pulse" style={{ color: 'rgba(240,165,0,0.6)' }}>
          생각 중…
        </span>
      )}
    </div>
  )
}
