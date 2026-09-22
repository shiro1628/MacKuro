import { PawIcon } from '../KuroCat'

interface Props {
  hasProject: boolean
  autoSnippet: boolean
  onToggleAutoSnippet: () => void
  agyIdeOpen: boolean
  onOpenAgyIde: () => void
  browserRunning: boolean
  browserPort: number | null
  onToggleBrowser: () => void
  onRestartClaude: () => void
}

const buttonBase = 'titlebar-nodrag mac-toolbar-button flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md border transition-all duration-150'
const activeStyle = 'text-accent border-accent/40 bg-accent/8'

export default function ToolbarActions({
  hasProject, autoSnippet, onToggleAutoSnippet,
  agyIdeOpen, onOpenAgyIde,
  browserRunning, browserPort, onToggleBrowser,
  onRestartClaude,
}: Props) {
  return (
    <div className="titlebar-nodrag mac-toolbar-actions flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-1">
      {/* Auto-snippet toggle */}
      <button
        onClick={onToggleAutoSnippet}
        className={`${buttonBase} ${autoSnippet ? activeStyle : 'text-gray-600 border-surface-border hover:text-gray-400'}`}
        title={autoSnippet ? '자동 snippet 래핑 켜짐' : '자동 snippet 래핑 꺼짐'}
      >
        <PawIcon size={10} />
        snip
      </button>

      {/* Open in Antigravity IDE */}
      <button
        onClick={onOpenAgyIde}
        disabled={!hasProject}
        className={`${buttonBase} disabled:opacity-25 disabled:cursor-not-allowed ${
          agyIdeOpen ? activeStyle : 'text-gray-600 border-surface-border hover:text-gray-300 hover:border-gray-500'
        }`}
        title={agyIdeOpen ? 'Antigravity IDE 실행 중' : 'Antigravity IDE에서 열기'}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
        Agy IDE
      </button>

      {/* Shared browser */}
      <button
        onClick={onToggleBrowser}
        className={`${buttonBase} ${browserRunning ? activeStyle : 'text-gray-600 border-surface-border hover:text-gray-400'}`}
        title={browserRunning ? `공유 브라우저 실행 중 — CDP :${browserPort}\n클릭하면 종료` : '공유 브라우저 시작 (CDP)'}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        {browserRunning ? '브라우저 ●' : '브라우저'}
      </button>

      {/* Claude 재시작 */}
      <button
        onClick={onRestartClaude}
        disabled={!hasProject}
        className="titlebar-nodrag mac-toolbar-button px-1.5 py-0.5 text-xs rounded-md border border-surface-border text-gray-600 hover:text-orange-400 hover:border-orange-400/40 transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed"
        title="Claude 재시작 — 브라우저 공유 후 MCP 적용"
      >
        ↺ Claude
      </button>
    </div>
  )
}
