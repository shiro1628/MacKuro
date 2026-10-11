import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useProjectStore, useProjectStoreApi } from '../../store/projectStore'
import { useTerminal } from '../../hooks/useTerminal'
import SnippetInput from './SnippetInput'
import { PawIcon } from '../KuroCat'
import TermContextMenu from '../TermContextMenu'

/**
 * Heuristic for "this looks pasted from an editor" rather than typed. Plain
 * indentation is deliberately not a signal on its own — indented prose and
 * pasted logs matched it, and got wrapped in <snippet> against the user's
 * intent. Require actual code punctuation or a keyword.
 */
function looksLikeCode(data: string): boolean {
  const lines = data.split('\n')
  if (lines.length < 3) return false
  return /[{};()=>]/.test(data)                                                  // 코드 문법 문자
    || /^\s*(const|let|var|def|fn|func|import|export|class|if|for|return)\b/m.test(data) // 키워드
}

export default function ClaudePanel() {
  const store = useProjectStoreApi()
  const project = useProjectStore(s => s.project)
  const projectId = useProjectStore(s => s.id)
  const ptyId = useProjectStore(s => s.claudePtyId)
  const setClaudeRunning = useProjectStore(s => s.setClaudeRunning)
  const log = useProjectStore(s => s.log)
  const claudeRunning = useProjectStore(s => s.claudeRunning)
  const claudeRestartSignal = useProjectStore(s => s.claudeRestartSignal)
  const autoSnippet = useAppStore(s => s.autoSnippet)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; selection: string } | null>(null)

  const { containerRef, termRef } = useTerminal({
    ptyId,
    cwd: project?.path ?? '',
    spawnArgs: ['-l', '-i', '-c', 'claude'],
    enabled: !!project,
    restartKey: `${project?.path}:${claudeRestartSignal}`,
    fontSize: 13,
    cursorColor: '#7c6af7',
    selectionBackground: '#3a3a5c',
    webLinks: true,
    // A project started in the background (broadcast) must not steal the keyboard.
    focusOnMount: useAppStore.getState().activeId === projectId,
    onInput: data => {
      if (looksLikeCode(data) && autoSnippet) {
        window.kuro.ptyWrite(ptyId, `<snippet>\n${data.trimEnd()}\n</snippet>\n`)
        log('info', `코드 붙여넣기 → snippet 자동 래핑 (${data.split('\n').length}줄)`)
      } else {
        window.kuro.ptyWrite(ptyId, data)
      }
    },
    onExit: (code, term) => {
      setClaudeRunning(false)
      term.write(`\r\n\x1b[90m[claude exited: ${code}]\x1b[0m\r\n`)
      log('warn', `Claude Code exited (code ${code})`)
    },
    onSpawned: (result, term) => {
      if (result.success) {
        setClaudeRunning(true)
        log('success', `Claude Code terminal started in ${project?.path}`)
      } else {
        term.write(`\x1b[31mFailed to start terminal: ${result.error}\x1b[0m\r\n`)
        log('error', `Claude terminal spawn failed: ${result.error}`)
      }
    },
  })

  // Coming back to this project: hand the keyboard to its Claude terminal.
  const isActive = useAppStore(s => s.activeId === projectId)
  useEffect(() => {
    if (isActive) requestAnimationFrame(() => termRef.current?.focus())
  }, [isActive])

  // Sidebar activity: remember when Claude last printed, and flag output that
  // arrives while this project is in the background. Throttled — the TUI
  // spinner emits many chunks a second.
  useEffect(() => {
    return window.kuro.onPtyData(id => {
      if (id !== ptyId) return
      const now = Date.now()
      const s = store.getState()
      const background = useAppStore.getState().activeId !== projectId
      if (now - s.lastOutputAt > 500 || (background && !s.unread)) {
        store.setState({ lastOutputAt: now, unread: s.unread || background })
      }
    })
  }, [ptyId, projectId])

  // Agy IDE extension에서 보내는 에러+코드 수신 → snippet 자동 주입 (앞에 보이는 프로젝트만)
  useEffect(() => {
    return window.kuro.onExternalInject(({ code, error, file, lines }) => {
      if (useAppStore.getState().activeId !== projectId) return
      const attrs = [
        file ? `file="${file}"` : '',
        lines ? `lines="${lines}"` : '',
      ].filter(Boolean).join(' ')

      const parts: string[] = []
      if (file) parts.push(`파일: ${file}${lines ? ` (${lines}줄)` : ''}`)
      parts.push(`<snippet${attrs ? ' ' + attrs : ''}>\n${code.trim()}\n</snippet>`)
      if (error) parts.push(`에러:\n${error.trim()}`)
      parts.push('위 에러를 수정해줘')

      // Bracketed paste로 감싸면 중간 \r이 Enter로 해석되지 않음
      const msg = parts.join('\n')
      window.kuro.ptyWrite(ptyId, `\x1b[200~${msg}\x1b[201~\r`)
      log('success', `Agy IDE에서 에러 수신${file ? ` — ${file}${lines ? ':' + lines : ''}` : ''}`)

      // 포커스를 Kuro로 가져옴
      window.focus()
    })
  }, [ptyId, projectId])

  // 스니펫을 Claude PTY에 직접 주입
  const handleSnippetSend = (formatted: string) => {
    // Claude Code는 paste 이벤트 없이 raw 텍스트를 받으므로
    // 개행을 \r\n으로 변환하고 마지막에 Enter 전송
    const encoded = formatted.replace(/\n/g, '\r\n')
    window.kuro.ptyWrite(ptyId, encoded + '\r')
    log('info', `스니펫 주입: ${formatted.split('\n')[0].slice(0, 60)}…`)
  }

  return (
    <div className="panel h-full">
      <div className="panel-header">
        <PawIcon size={12} className={claudeRunning ? 'text-accent' : 'text-gray-700'} />
        Claude Code
        {claudeRunning && (
          <span className="text-xs font-normal normal-case" style={{ color: 'rgba(240,165,0,0.5)' }}>
            집사 대기 중
          </span>
        )}
        <span className="ml-auto text-gray-700 text-xs font-mono font-normal">{project?.name}</span>
      </div>
      <div className="panel-body">
        <div
          ref={containerRef}
          className="xterm-container"
          onClick={() => termRef.current?.focus()}
          onContextMenu={e => {
            e.preventDefault()
            const sel = termRef.current?.getSelection() ?? ''
            setCtxMenu({ x: e.clientX, y: e.clientY, selection: sel })
          }}
        />
        {ctxMenu && termRef.current && (
          <TermContextMenu
            x={ctxMenu.x} y={ctxMenu.y}
            term={termRef.current} ptyId={ptyId}
            selection={ctxMenu.selection}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
      <SnippetInput onSend={handleSnippetSend} />
    </div>
  )
}
