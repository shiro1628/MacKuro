import { useEffect, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

const AGY_POLL_MS = 3000

/** Live state of the things the toolbar reports: server, browser, IDE, Codex. */
export function useEnvironmentStatus() {
  const log = useAppStore(s => s.log)
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [browserRunning, setBrowserRunning] = useState(false)
  const [browserPort, setBrowserPort] = useState<number | null>(null)
  const [agyIdeOpen, setAgyIdeOpen] = useState(false)
  const [codexAvailable, setCodexAvailable] = useState(false)

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
    const timer = setInterval(checkAgyIde, AGY_POLL_MS)

    return () => { offReady(); offError(); offBrowserUp(); offBrowserDown(); clearInterval(timer) }
  }, [])

  return { serverPort, browserRunning, browserPort, agyIdeOpen, codexAvailable }
}
