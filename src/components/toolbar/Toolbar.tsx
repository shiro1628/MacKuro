import { useAppStore } from '../../store/useAppStore'
import KuroCat, { PawIcon } from '../KuroCat'
import ToolbarActions from './ToolbarActions'
import UsageChips from './UsageChips'
import { useEnvironmentStatus } from './hooks/useEnvironmentStatus'
import { useUsageSummary } from './hooks/useUsageSummary'

export default function Toolbar() {
  const project = useAppStore(s => s.project)
  const claudeRunning = useAppStore(s => s.claudeRunning)
  const devServerRunning = useAppStore(s => s.devServerRunning)
  const devServerCommand = useAppStore(s => s.devServerCommand)
  const autoSnippet = useAppStore(s => s.autoSnippet)
  const clearProject = useAppStore(s => s.clearProject)
  const toggleAutoSnippet = useAppStore(s => s.toggleAutoSnippet)
  const restartClaude = useAppStore(s => s.restartClaude)
  const log = useAppStore(s => s.log)

  const { serverPort, browserRunning, browserPort, agyIdeOpen, codexAvailable } = useEnvironmentStatus()
  const usage = useUsageSummary(project?.path)

  const handleChangeProject = async () => {
    if (browserRunning && project) await window.kuro.browserStop({ projectPath: project.path })
    // Dev server tabs unmount with the layout and kill their own PTYs.
    await window.kuro.ptyKill('claude')
    clearProject()
  }

  const handleOpenAgyIde = async () => {
    if (!project) return
    const result = await window.kuro.agyIdeOpen({ projectPath: project.path })
    if (!result.success) log('error', `Antigravity IDE 실행 실패: ${result.error}`)
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

      <UsageChips usage={usage} codexAvailable={codexAvailable} />

      <ToolbarActions
        hasProject={!!project}
        autoSnippet={autoSnippet}
        onToggleAutoSnippet={toggleAutoSnippet}
        agyIdeOpen={agyIdeOpen}
        onOpenAgyIde={handleOpenAgyIde}
        browserRunning={browserRunning}
        browserPort={browserPort}
        onToggleBrowser={handleBrowserToggle}
        onRestartClaude={handleRestartClaude}
      />

      {/* Status — 텍스트 제거하고 점만 */}
      <div className="titlebar-nodrag mac-toolbar-status flex items-center gap-2 ml-1 pl-2" title={`Claude: ${claudeRunning ? '실행 중' : '대기'} / Dev: ${devServerRunning ? '실행 중' : '대기'}`}>
        <span className={`status-dot ${claudeRunning ? 'running' : 'idle'}`} />
        <span className={`status-dot ${devServerRunning ? 'running' : 'idle'}`} />
      </div>
    </div>
  )
}
