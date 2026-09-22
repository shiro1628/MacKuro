import { useCallback, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface Options {
  ptyId: string
  cwd: string
  /** Arguments for the login shell the PTY spawns. */
  spawnArgs: string[]
  /** Skip setup entirely until the caller is ready. */
  enabled?: boolean
  /** Changing this tears the terminal down and spawns a fresh PTY. */
  restartKey?: string | number
  fontSize: number
  cursorColor: string
  selectionBackground?: string
  webLinks?: boolean
  focusOnMount?: boolean
  killOnUnmount?: boolean
  /** Keystrokes and pasted text from the terminal. */
  onInput: (data: string) => void
  onExit?: (code: number, term: Terminal) => void
  onSpawned?: (result: { success: boolean; error?: string }, term: Terminal) => void
}

/**
 * An xterm view bound to a main-process PTY: construction, sizing, the
 * data/exit subscriptions and teardown. Callers supply only what differs.
 */
export function useTerminal(options: Options) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  // Read callbacks through a ref so changing them never respawns the PTY.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const { ptyId, enabled = true, restartKey } = options

  /** Resize the terminal to its container and tell the PTY the new size. */
  const refit = useCallback(() => {
    const term = termRef.current
    if (!term || !fitRef.current) return
    fitRef.current.fit()
    window.kuro.ptyResize(ptyId, term.cols, term.rows)
  }, [ptyId])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return
    const o = optionsRef.current

    const term = new Terminal({
      theme: {
        background: '#0f0f0f',
        foreground: '#d4d4d4',
        cursor: o.cursorColor,
        ...(o.selectionBackground ? { selectionBackground: o.selectionBackground } : {}),
      },
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: o.fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    if (o.webLinks) term.loadAddon(new WebLinksAddon())
    term.open(el)
    termRef.current = term
    fitRef.current = fit

    // 레이아웃 완료 후 fit (dimensions 에러 방지)
    requestAnimationFrame(() => {
      fit.fit()
      window.kuro.ptyResize(o.ptyId, term.cols, term.rows)
      if (o.focusOnMount) term.focus()
    })

    const offData = window.kuro.onPtyData((id, data) => {
      if (id === o.ptyId) term.write(data)
    })
    const offExit = window.kuro.onPtyExit((id, code) => {
      if (id === o.ptyId) optionsRef.current.onExit?.(code, term)
    })
    term.onData(data => optionsRef.current.onInput(data))

    const observer = new ResizeObserver(() => {
      fit.fit()
      window.kuro.ptyResize(o.ptyId, term.cols, term.rows)
    })
    observer.observe(el)

    window.kuro.ptySpawn({ id: o.ptyId, cwd: o.cwd, command: '/bin/zsh', args: o.spawnArgs })
      .then(result => optionsRef.current.onSpawned?.(result, term))

    return () => {
      offData()
      offExit()
      observer.disconnect()
      if (o.killOnUnmount) window.kuro.ptyKill(o.ptyId)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [enabled, restartKey])

  return { containerRef, termRef, refit }
}
