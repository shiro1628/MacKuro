import { app, ipcMain } from 'electron'
import { spawn as spawnChild, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { request } from 'http'
import { join } from 'path'
import { CDP_PORT } from '../constants'
import { send } from '../window'
import { getCdpEndpoint, setCdpEndpoint } from './mcp'

const CDP_READY_TIMEOUT_MS = 8000
const CDP_POLL_MS = 250

/** Chrome MacKuro launched itself; null when attached to a user's browser or off. */
let browserProc: ChildProcess | null = null

// Find a macOS browser application binary.
function findBrowser(): string | null {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  return candidates.find(p => existsSync(p)) ?? null
}

/** True when a CDP server answers on the shared-browser port. */
function cdpReachable(): Promise<boolean> {
  return new Promise(resolve => {
    const req = request({ host: '127.0.0.1', port: CDP_PORT, path: '/json/version', timeout: 800 }, res => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

/** Wait until CDP answers, or give up when the timeout passes or `proc` exits. */
async function waitForCdp(proc: ChildProcess): Promise<boolean> {
  const deadline = Date.now() + CDP_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode !== null) return false
    if (await cdpReachable()) return true
    await new Promise(r => setTimeout(r, CDP_POLL_MS))
  }
  return false
}

/**
 * Stop sharing the browser: kill the Chrome MacKuro launched, or just detach
 * from a browser the user started. Safe to call when nothing is running.
 */
export function stopBrowser() {
  const proc = browserProc
  browserProc = null
  if (proc) {
    proc.removeAllListeners('exit')
    try { proc.kill() } catch {}
  }
  if (proc || getCdpEndpoint()) {
    setCdpEndpoint(null)
    send('browser:stopped')
  }
}

/** Shared browser over CDP, so Claude's Playwright MCP drives the same window. */
export function registerBrowserIpc() {
  // Check if a CDP endpoint is already reachable
  ipcMain.handle('browser:detect', async () => {
    const running = await cdpReachable()
    return { running, endpoint: running ? `http://localhost:${CDP_PORT}` : null }
  })

  // Attach Playwright MCP to a browser the user already runs with CDP on.
  ipcMain.handle('browser:connect', async (_, { endpoint }: { projectPath: string; endpoint: string }) => {
    stopBrowser()
    setCdpEndpoint(endpoint)
    send('browser:launched', { port: CDP_PORT, url: '', connected: true })
    return { success: true }
  })

  ipcMain.handle('browser:launch', async (_, { url }: { projectPath: string; url?: string }) => {
    stopBrowser()

    const exe = findBrowser()
    if (!exe) return { success: false, error: 'Chrome / Edge를 찾을 수 없습니다' }

    const userDataDir = join(app.getPath('userData'), 'kuro-browser-profile')
    const args = [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      url ?? 'about:blank',
    ]

    const proc = spawnChild(exe, args, { detached: false, stdio: 'ignore' })
    proc.on('error', () => {})
    browserProc = proc

    if (!await waitForCdp(proc)) {
      if (browserProc === proc) browserProc = null
      try { proc.kill() } catch {}
      return { success: false, error: `CDP :${CDP_PORT}가 응답하지 않습니다 — 포트를 다른 프로그램이 쓰고 있을 수 있습니다` }
    }
    // Another launch or a stop may have replaced this one while we waited.
    if (browserProc !== proc) return { success: false, error: '브라우저 실행이 취소되었습니다' }

    proc.on('exit', () => {
      if (browserProc !== proc) return
      browserProc = null
      setCdpEndpoint(null)
      send('browser:stopped')
    })
    setCdpEndpoint(`http://localhost:${CDP_PORT}`)
    send('browser:launched', { port: CDP_PORT, url: url ?? '' })
    return { success: true, port: CDP_PORT }
  })

  ipcMain.handle('browser:stop', async () => {
    stopBrowser()
    return { success: true }
  })

  // Shared means Claude is pointed at a CDP endpoint, whoever launched the browser.
  ipcMain.handle('browser:status', async () => ({
    running: !!getCdpEndpoint(),
    port: getCdpEndpoint() ? CDP_PORT : null,
  }))
}
