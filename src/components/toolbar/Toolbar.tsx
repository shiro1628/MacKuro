import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import KuroCat, { PawIcon } from '../KuroCat'

export default function Toolbar() {
  const { project, claudeRunning, devServerRunning, devServerCommand, autoSnippet, clearProject, toggleAutoSnippet, log, restartClaude } = useAppStore()
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [browserRunning, setBrowserRunning] = useState(false)
  const [browserPort, setBrowserPort] = useState<number | null>(null)
  const [agyIdeOpen, setAgyIdeOpen] = useState(false)
  const [codexAvailable, setCodexAvailable] = useState(false)
  const [usage, setUsage] = useState({ claudeCost: 0, codexCost: 0, codexTokens: 0, codexEstimated: true })

  useEffect(() => {
    const offReady = window.kuro.onServerReady(port => {
      setServerPort(port)
      log('success', `MacKuro HTTP 서버 시작 — localhost:${port}`)
    })
    const offError = window.kuro.onServerError(msg => {
      log('error', `HTTP 서버 오류: ${msg}`)
    })
    const offBrowserUp = window.kuro.onBrowserLaunched(({ port }) => {
      setBrowserRunning(true)
      setBrowserPort(port)
      log('success', `공유 브라우저 시작 — CDP :${port} / Claude Playwright MCP 연결됨`)
    })
    const offBrowserDown = window.kuro.onBrowserStopped(() => {
      setBrowserRunning(false)
      setBrowserPort(null)
      log('info', '공유 브라우저 종료')
    })
    window.kuro.getServerPort().then(setServerPort)
    window.kuro.browserStatus().then(s => { setBrowserRunning(s.running); setBrowserPort(s.port) })

    // Poll Antigravity IDE state every 3s
    const checkAgyIde = () => window.kuro.agyIdeRunning().then(setAgyIdeOpen)
    checkAgyIde()
    window.kuro.codexStatus().then(({ available }) => setCodexAvailable(available))
    const timer = setInterval(checkAgyIde, 3000)

    return () => { offReady(); offError(); offBrowserUp(); offBrowserDown(); clearInterval(timer) }
  }, [])

  useEffect(() => {
    const refreshUsage = () => window.kuro.usageSummary(project?.path).then(setUsage)
    refreshUsage()
    const timer = setInterval(refreshUsage, 10000)
    return () => clearInterval(timer)
  }, [project?.path])

  const handleChangeProject = async () => {
    if (browserRunning && project) await window.kuro.browserStop({ projectPath: project.path })
    await window.kuro.ptyKill('claude')
    await window.kuro.ptyKill('devserver')
    clearProject()
  }

  const handleBrowserToggle = async () => {
    if (!project) return
    if (browserRunning) {
      await window.kuro.browserStop({ projectPath: project.path })
      return
    }
    // 이미 실행 중인 Chrome CDP가 있으면 연결, 없으면 직접 실행
    const detected = await window.kuro.browserDetect()
    if (detected.running && detected.endpoint) {
      await window.kuro.browserConnect({ projectPath: project.path, endpoint: detected.endpoint })
      log('info', `실행 중인 Chrome에 연결 — ${detected.endpoint}`)
    } else {
      const url = devServerCommand ? 'http://localhost:3000' : 'about:blank'
      const result = await window.kuro.browserLaunch({ projectPath: project.path, url })
      if (!result.success) { log('error', `브라우저 실행 실패: ${result.error}`); return }
    }
    // 브라우저 시작 후 MCP 설정이 업데이트됐으므로 Claude 재시작 필요
    log('warn', '공유 브라우저 연결됨 — Claude를 재시작해야 Playwright MCP가 이 브라우저를 사용합니다 (↺ 버튼)')
  }

  const handleRestartClaude = () => {
    restartClaude()
    log('info', 'Claude 재시작 중 — Playwright MCP가 공유 브라우저에 연결됩니다')
  }

return (
    <div className="titlebar-drag mac-toolbar flex items-center gap-2 h-11 bg-surface-1 border-b border-surface-border flex-shrink-0"
      style={{ borderBottomColor: '#1a1a1a', paddingLeft: '88px', paddingRight: '16px' }}>

      {/* Logo */}
      <div className="titlebar-nodrag flex items-center gap-1.5 mr-1 select-none mac-toolbar-brand">
        <KuroCat size={31} animate={false} className="opacity-95 mac-toolbar-cat" />
        <span className="text-white font-bold text-sm tracking-widest uppercase"
          style={{ letterSpacing: '0.2em', textShadow: '0 0 10px rgba(240,165,0,0.3)' }}>
          MacKuro
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-surface-border opacity-50" />

      {/* Project path */}
      <div className="titlebar-nodrag flex items-center gap-1.5 bg-surface-2/70 rounded-md px-2.5 py-1 text-xs text-gray-500 max-w-[220px] truncate mac-toolbar-project">
        <PawIcon size={11} className="text-accent opacity-60 flex-shrink-0" />
        <span className="truncate">{project?.name ?? '—'}</span>
      </div>

      {/* Change project */}
      <button
        onClick={handleChangeProject}
        className="titlebar-nodrag px-2 py-1 text-xs text-gray-600 hover:text-gray-300 hover:bg-surface-2 rounded transition-colors"
      >
        변경
      </button>

      <div className="flex-1 min-w-2" />

      {/* Dev server command */}
      {devServerCommand && (
        <span className="titlebar-nodrag text-xs text-gray-700 font-mono">
          {devServerCommand.script}
        </span>
      )}

      {/* Local injection server port */}
      {serverPort && (
        <span
          className="titlebar-nodrag flex items-center gap-1 text-xs font-mono cursor-default"
          style={{ color: 'rgba(240,165,0,0.4)' }}
          title={`IDE 연동 서버: localhost:${serverPort}`}
        >
          <span className="status-dot running" style={{ width: 5, height: 5 }} />
          :{serverPort}
        </span>
      )}

      <div className="titlebar-nodrag ai-usage flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-1"
        title={`로컬 로그 기준 누적 비용\nClaude: $${usage.claudeCost.toFixed(2)}\nCodex: $${usage.codexCost.toFixed(2)}${usage.codexEstimated ? ' (추정)' : ''}\nCodex 토큰: ${usage.codexTokens.toLocaleString()}`}>
        <span className="ai-usage-chip active"><i />Claude ${usage.claudeCost.toFixed(2)}</span>
        <span className={`ai-usage-chip ${codexAvailable ? 'available codex' : ''}`}><i />Codex ${usage.codexCost.toFixed(2)}</span>
      </div>

      <div className="titlebar-nodrag mac-toolbar-actions flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-1">
      {/* Auto-snippet toggle */}
      <button
        onClick={toggleAutoSnippet}
        className={`titlebar-nodrag mac-toolbar-button flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md border transition-all duration-150 ${
          autoSnippet ? 'text-accent border-accent/40 bg-accent/8' : 'text-gray-600 border-surface-border hover:text-gray-400'
        }`}
        title={autoSnippet ? '자동 snippet 래핑 켜짐' : '자동 snippet 래핑 꺼짐'}
      >
        <PawIcon size={10} />
        snip
      </button>

      {/* Open in Antigravity IDE */}
      <button
        onClick={async () => {
          if (!project) return
          const result = await window.kuro.agyIdeOpen({ projectPath: project.path })
          if (!result.success) log('error', `Antigravity IDE 실행 실패: ${result.error}`)
        }}
        disabled={!project}
        className={`titlebar-nodrag mac-toolbar-button flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md border transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed ${
          agyIdeOpen ? 'text-accent border-accent/40 bg-accent/8' : 'text-gray-600 border-surface-border hover:text-gray-300 hover:border-gray-500'
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
        onClick={handleBrowserToggle}
        className={`titlebar-nodrag mac-toolbar-button flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-md border transition-all duration-150 ${
          browserRunning ? 'text-accent border-accent/40 bg-accent/8' : 'text-gray-600 border-surface-border hover:text-gray-400'
        }`}
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
        onClick={handleRestartClaude}
        disabled={!project}
        className="titlebar-nodrag mac-toolbar-button px-1.5 py-0.5 text-xs rounded-md border border-surface-border text-gray-600 hover:text-orange-400 hover:border-orange-400/40 transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed"
        title="Claude 재시작 — 브라우저 공유 후 MCP 적용"
      >
        ↺ Claude
      </button>
      </div>


{/* Status — 텍스트 제거하고 점만 */}
      <div className="titlebar-nodrag mac-toolbar-status flex items-center gap-2 ml-1 pl-2" title={`Claude: ${claudeRunning ? '실행 중' : '대기'} / Dev: ${devServerRunning ? '실행 중' : '대기'}`}>
        <span className={`status-dot ${claudeRunning ? 'running' : 'idle'}`} />
        <span className={`status-dot ${devServerRunning ? 'running' : 'idle'}`} />
      </div>
    </div>
  )
}
