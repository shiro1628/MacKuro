import { useEffect, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { useTerminal } from '../../../hooks/useTerminal'
import TermContextMenu from '../../TermContextMenu'
import { spawnArgsFor, type TabInfo } from './tabs'

interface Props {
  tab: TabInfo
  active: boolean
  projectPath: string
  autoCommand: string | null
}

export default function TerminalPane({ tab, active, projectPath, autoCommand }: Props) {
  const log = useAppStore(s => s.log)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; selection: string } | null>(null)

  const { containerRef, termRef, refit } = useTerminal({
    ptyId: tab.ptyId,
    cwd: projectPath,
    spawnArgs: spawnArgsFor(autoCommand),
    fontSize: 12,
    cursorColor: '#4ade80',
    focusOnMount: active,
    killOnUnmount: true,
    onInput: data => window.kuro.ptyWrite(tab.ptyId, data),
    onExit: (code, term) => {
      term.write(`\r\n\x1b[90m[exited: ${code}]\x1b[0m\r\n`)
      log('warn', `[${tab.label}] exited (code ${code})`)
    },
    onSpawned: (result, term) => {
      if (result.success) {
        log('success', `[${tab.label}] started`)
      } else {
        term.write(`\x1b[31mFailed: ${result.error}\x1b[0m\r\n`)
        log('error', `[${tab.label}] spawn failed: ${result.error}`)
      }
    },
  })

  // re-fit & focus when tab becomes active
  useEffect(() => {
    if (!active) return
    requestAnimationFrame(() => {
      refit()
      termRef.current?.focus()
    })
  }, [active, refit])

  return (
    <>
      <div
        ref={containerRef}
        className="xterm-container"
        style={{ display: active ? 'block' : 'none' }}
        onClick={() => termRef.current?.focus()}
        onContextMenu={e => {
          e.preventDefault()
          const sel = termRef.current?.getSelection() ?? ''
          setCtxMenu({ x: e.clientX, y: e.clientY, selection: sel })
        }}
      />
      {ctxMenu && termRef.current && active && (
        <TermContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          term={termRef.current} ptyId={tab.ptyId}
          selection={ctxMenu.selection}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}
