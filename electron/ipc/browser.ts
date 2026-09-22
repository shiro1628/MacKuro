import { app, ipcMain } from 'electron'
import { spawn as spawnChild, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { CDP_PORT } from '../constants'
import { send } from '../window'
import { getCdpEndpoint, injectMcp, setCdpEndpoint } from './mcp'

let browserProc: ChildProcess | null = null

// Find a macOS browser application binary.
function findBrowser(): string | null {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  return candidates.find(p => existsSync(p)) ?? null
}

function stopBrowser() {
  if (browserProc) {
    try { browserProc.kill() } catch {}
    browserProc = null
    setCdpEndpoint(null)
  }
}

/** Shared browser over CDP, so Claude's Playwright MCP drives the same window. */
export function registerBrowserIpc() {
  // Check if a CDP endpoint is already reachable
  ipcMain.handle('browser:detect', async () => {
    try {
      const { request } = await import('http')
      const reachable = await new Promise<boolean>(resolve => {
        const req = request({ host: '127.0.0.1', port: CDP_PORT, path: '/json/version', timeout: 800 }, res => {
          resolve(res.statusCode === 200)
        })
        req.on('error', () => resolve(false))
        req.on('timeout', () => { req.destroy(); resolve(false) })
        req.end()
      })
      return { running: reachable, endpoint: reachable ? `http://localhost:${CDP_PORT}` : null }
    } catch {
      return { running: false, endpoint: null }
    }
  })

  ipcMain.handle('browser:connect', async (_, { projectPath, endpoint }: { projectPath: string; endpoint: string }) => {
    // Connect Playwright MCP to an already-running browser (user-launched)
    setCdpEndpoint(endpoint)
    if (projectPath) {
      try { injectMcp() } catch {}
    }
    send('browser:launched', { port: CDP_PORT, url: '', connected: true })
    return { success: true }
  })

  ipcMain.handle('browser:launch', async (_, { projectPath, url }: { projectPath: string; url?: string }) => {
    // Kill existing browser if any
    stopBrowser()

    const exe = findBrowser()
    if (!exe) return { success: false, error: 'Chrome / Edge를 찾을 수 없습니다' }

    const userDataDir = join(app.getPath('userData'), 'kuro-browser-profile')
    const args = [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions-except=',
      url ?? 'about:blank',
    ]

    browserProc = spawnChild(exe, args, { detached: false, stdio: 'ignore' })
    setCdpEndpoint(`http://localhost:${CDP_PORT}`)

    browserProc.on('exit', () => {
      browserProc = null
      setCdpEndpoint(null)
      send('browser:stopped')
    })

    // Re-inject MCP with CDP endpoint so Claude connects to this browser
    if (projectPath) {
      try { injectMcp() } catch {}
    }

    // Small delay for Chrome to start the CDP server
    await new Promise(r => setTimeout(r, 800))
    send('browser:launched', { port: CDP_PORT, url: url ?? '' })

    return { success: true, port: CDP_PORT }
  })

  ipcMain.handle('browser:stop', async (_, { projectPath }: { projectPath: string }) => {
    stopBrowser()
    // Re-inject MCP without CDP so it falls back to standalone headed mode
    if (projectPath) {
      try { injectMcp() } catch {}
    }
    return { success: true }
  })

  ipcMain.handle('browser:status', async () => ({
    running: !!browserProc,
    port: getCdpEndpoint() ? CDP_PORT : null,
  }))
}
