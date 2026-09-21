import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { spawn as spawnChild, type ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs'
import { createServer, type Server } from 'http'
import { randomBytes, timingSafeEqual } from 'crypto'
import * as nodePty from 'node-pty'

// Electron's development bundle is normally labelled "Electron" by macOS.
// Set the product name as early as possible so the Dock/menu identify MacKuro.
if (process.platform === 'darwin') app.setName('MacKuro')

const KURO_PORT = 7890
const CDP_PORT = 9222
let httpServer: Server | null = null
let browserProc: ChildProcess | null = null
let browserCdpEndpoint: string | null = null

// /inject 인증 토큰 — 파일 시스템 접근이 가능한 로컬 IDE 확장만
// 읽을 수 있고, 브라우저의 웹페이지는 읽을 수 없다 (drive-by 주입 차단)
const KURO_TOKEN = randomBytes(32).toString('hex')

function writeTokenFile() {
  const dir = join(homedir(), '.kuro')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'token'), KURO_TOKEN, { encoding: 'utf-8', mode: 0o600 })
}

function isValidToken(header: string | string[] | undefined): boolean {
  if (typeof header !== 'string') return false
  const a = Buffer.from(header)
  const b = Buffer.from(KURO_TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Find a macOS browser application binary.
function findBrowser(): string | null {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  return candidates.find(p => existsSync(p)) ?? null
}

let mainWindow: BrowserWindow | null = null
const ptys = new Map<string, nodePty.IPty>()

function createWindow() {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1440, Math.max(1180, workAreaWidth - 80))
  const height = Math.min(900, Math.max(720, workAreaHeight - 80))

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1180,
    minHeight: 720,
    center: true,
    show: false,
    backgroundColor: '#0f0f0f',
    icon: existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f0f',
      symbolColor: '#888888',
      height: 32,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── PTY ────────────────────────────────────────────────────────────────────

// Renderer can only request the user's approved login shells.
const PTY_ALLOWED_COMMANDS = new Set(['/bin/zsh', '/bin/bash', 'zsh', 'bash'])

ipcMain.handle('pty:spawn', async (_, { id, cwd, command, args }: {
  id: string; cwd: string; command: string; args?: string[]
}) => {
  if (!PTY_ALLOWED_COMMANDS.has(command.toLowerCase())) {
    return { success: false, error: `허용되지 않은 명령: ${command}` }
  }
  if (ptys.has(id)) {
    try { ptys.get(id)!.kill() } catch {}
    ptys.delete(id)
  }
  try {
    const currentPath = process.env.PATH ?? ''

    const pty = nodePty.spawn(command, args ?? [], {
      name: 'xterm-256color',
      cwd,
      env: {
        ...process.env,
        PATH: currentPath,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
      cols: 120,
      rows: 40,
    })
    pty.onData(data => mainWindow?.webContents.send('pty:data', { id, data }))
    pty.onExit(({ exitCode }) => {
      mainWindow?.webContents.send('pty:exit', { id, exitCode })
      ptys.delete(id)
    })
    ptys.set(id, pty)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.on('pty:write', (_, { id, data }: { id: string; data: string }) => {
  ptys.get(id)?.write(data)
})

ipcMain.handle('pty:resize', async (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  try { ptys.get(id)?.resize(cols, rows) } catch {}
})

ipcMain.handle('pty:kill', async (_, { id }: { id: string }) => {
  const pty = ptys.get(id)
  if (pty) {
    // PTYs are process-group leaders on macOS; terminate the whole group.
    try { process.kill(-pty.pid, 'SIGTERM') } catch {}
    try { pty.kill() } catch {}
    ptys.delete(id)
  }
})

// ─── Antigravity IDE ─────────────────────────────────────────────────────────

function findAgyIde(): string | null {
  const candidates = ['/Applications/Antigravity.app', '/Applications/Antigravity IDE.app']
  return candidates.find(existsSync) ?? null
}

ipcMain.handle('agy-ide:open', async (_, { projectPath }: { projectPath: string }) => {
  try {
    const appPath = findAgyIde()
    if (!appPath) return { success: false, error: 'Antigravity IDE를 찾을 수 없습니다.' }
    spawnChild('open', ['-a', appPath, projectPath], { stdio: 'ignore', detached: true }).unref()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('agy-ide:running', async () => {
  return new Promise<boolean>(resolve => {
    const child = spawnChild('pgrep', ['-f', 'Antigravity'], { stdio: 'ignore' })
    child.on('close', code => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
})

// ─── Clipboard ──────────────────────────────────────────────────────────────

ipcMain.handle('clipboard:read', () => {
  const { clipboard } = require('electron')
  return clipboard.readText()
})

ipcMain.handle('clipboard:write', (_, text: string) => {
  const { clipboard } = require('electron')
  clipboard.writeText(text)
})

// ─── Dialog ─────────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '프로젝트 폴더 선택',
  })
  return result.canceled ? null : result.filePaths[0]
})

// ─── MCP injection ───────────────────────────────────────────────────────────

function injectMcp(projectPath: string) {
  // Write to top-level mcpServers in ~/.claude.json — no path-matching issues
  const claudeJsonPath = join(homedir(), '.claude.json')

  let root: Record<string, any> = {}
  if (existsSync(claudeJsonPath)) {
    try { root = JSON.parse(readFileSync(claudeJsonPath, 'utf-8')) } catch {}
  }

  if (!root.mcpServers) root.mcpServers = {}

  const playwrightArgs = browserCdpEndpoint
    ? ['-y', '@playwright/mcp@latest', '--cdp-endpoint', browserCdpEndpoint]
    : ['-y', '@playwright/mcp@latest']

  root.mcpServers.playwright = {
    command: 'npx',
    args: playwrightArgs,
    disabled: false,
  }

  writeFileSync(claudeJsonPath, JSON.stringify(root, null, 2), 'utf-8')
  console.log('[mcp:inject] playwright →', playwrightArgs.join(' '))
}

ipcMain.handle('mcp:inject', async (_, { projectPath }: { projectPath: string }) => {
  try {
    injectMcp(projectPath)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ─── Shared browser (CDP) ────────────────────────────────────────────────────

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
  browserCdpEndpoint = endpoint
  if (projectPath) {
    try { injectMcp(projectPath) } catch {}
  }
  mainWindow?.webContents.send('browser:launched', { port: CDP_PORT, url: '', connected: true })
  return { success: true }
})

ipcMain.handle('browser:launch', async (_, { projectPath, url }: { projectPath: string; url?: string }) => {
  // Kill existing browser if any
  if (browserProc) {
    try { browserProc.kill() } catch {}
    browserProc = null
    browserCdpEndpoint = null
  }

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
  browserCdpEndpoint = `http://localhost:${CDP_PORT}`

  browserProc.on('exit', () => {
    browserProc = null
    browserCdpEndpoint = null
    mainWindow?.webContents.send('browser:stopped')
  })

  // Re-inject MCP with CDP endpoint so Claude connects to this browser
  if (projectPath) {
    try { injectMcp(projectPath) } catch {}
  }

  // Small delay for Chrome to start the CDP server
  await new Promise(r => setTimeout(r, 800))
  mainWindow?.webContents.send('browser:launched', { port: CDP_PORT, url: url ?? '' })

  return { success: true, port: CDP_PORT }
})

ipcMain.handle('browser:stop', async (_, { projectPath }: { projectPath: string }) => {
  if (browserProc) {
    try { browserProc.kill() } catch {}
    browserProc = null
    browserCdpEndpoint = null
  }
  // Re-inject MCP without CDP so it falls back to standalone headed mode
  if (projectPath) {
    try { injectMcp(projectPath) } catch {}
  }
  return { success: true }
})

ipcMain.handle('browser:status', async () => ({
  running: !!browserProc,
  port: browserCdpEndpoint ? CDP_PORT : null,
}))

// ─── Git diff ────────────────────────────────────────────────────────────────

ipcMain.handle('git:diff', async (_, { projectPath }: { projectPath: string }) => {
  return new Promise<{ diff: string; empty: boolean }>(resolve => {
    // Try uncommitted changes first (staged + unstaged)
    const child = spawnChild('git', ['diff', 'HEAD'], { cwd: projectPath, stdio: 'pipe' })
    let out = ''
    child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    child.on('close', code => {
      if (out.trim()) return resolve({ diff: out, empty: false })
      // No uncommitted changes — fall back to last commit
      const child2 = spawnChild('git', ['show', 'HEAD', '--format=commit %H%n%s%n', '-p'], { cwd: projectPath, stdio: 'pipe' })
      let out2 = ''
      child2.stdout?.on('data', (d: Buffer) => { out2 += d.toString() })
      child2.on('close', () => resolve({ diff: out2, empty: !out2.trim() }))
      child2.on('error', () => resolve({ diff: '', empty: true }))
    })
    child.on('error', () => resolve({ diff: '', empty: true }))
  })
})

ipcMain.handle('git:status', async (_, { projectPath }: { projectPath: string }) => {
  return new Promise<{ branch: string; files: { code: string; path: string }[]; summary: string }>(resolve => {
    const child = spawnChild('git', ['status', '--short', '--branch'], { cwd: projectPath, stdio: 'pipe' })
    let out = ''
    child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    child.on('close', code => {
      if (code !== 0) return resolve({ branch: '', files: [], summary: 'Git worktree를 읽을 수 없습니다.' })
      const lines = out.split(/\r?\n/).filter(Boolean)
      const branchLine = lines.shift() ?? ''
      const files = lines.map(line => ({
        code: line.slice(0, 2),
        path: line.slice(3).trim(),
      }))
      const changed = files.length
      resolve({
        branch: branchLine.replace(/^##\s*/, '').trim(),
        files,
        summary: changed ? `${changed}개 파일 변경` : '변경사항 없음',
      })
    })
    child.on('error', () => resolve({ branch: '', files: [], summary: 'Git worktree를 읽을 수 없습니다.' }))
  })
})

ipcMain.handle('git:worktree-add', async (_, { projectPath, branchName }: { projectPath: string; branchName: string }) => {
  const branch = branchName.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..')) {
    return { success: false, error: '브랜치 이름에 사용할 수 없는 문자가 있습니다.' }
  }
  const folder = branch.split('/').pop() || branch
  const worktreePath = join(projectPath, '.worktrees', folder)
  if (existsSync(worktreePath)) return { success: false, error: `이미 존재하는 폴더입니다: ${worktreePath}` }
  mkdirSync(join(projectPath, '.worktrees'), { recursive: true })
  return new Promise<{ success: boolean; path?: string; error?: string }>(resolve => {
    const child = spawnChild('git', ['worktree', 'add', '-b', branch, worktreePath], { cwd: projectPath, stdio: 'pipe' })
    let error = ''
    child.stderr?.on('data', (d: Buffer) => { error += d.toString() })
    child.on('close', code => code === 0
      ? resolve({ success: true, path: worktreePath })
      : resolve({ success: false, error: error.trim() || `git 종료 코드: ${code}` }))
    child.on('error', err => resolve({ success: false, error: err.message }))
  })
})

// ─── Dev server detection ────────────────────────────────────────────────────

ipcMain.handle('devserver:detect', async (_, { projectPath }: { projectPath: string }) => {
  try {
    const pkgPath = join(projectPath, 'package.json')
    if (!existsSync(pkgPath)) return null
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const scripts: Record<string, string> = pkg.scripts ?? {}
    for (const name of ['dev', 'start', 'serve', 'preview']) {
      if (scripts[name]) return { name, script: `npm run ${name}` }
    }
    return null
  } catch {
    return null
  }
})

// ─── Codex CLI invoke ────────────────────────────────────────────────────────

const codexCandidates = [
  '/Applications/ChatGPT.app/Contents/Resources/codex',
  join(homedir(), '.local', 'bin', 'codex'),
  'codex',
]

function jsonlFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? jsonlFiles(path) : entry.name.endsWith('.jsonl') ? [path] : []
  })
}

ipcMain.handle('usage:summary', async (_, { projectPath }: { projectPath?: string }) => {
  const claudeSessions = new Map<string, number>()
  const projectKey = projectPath ? projectPath.replaceAll('/', '-') : ''
  const claudeRoot = join(homedir(), '.claude', 'projects')
  const claudeDirs = projectKey && existsSync(join(claudeRoot, projectKey))
    ? [join(claudeRoot, projectKey)] : [claudeRoot]
  for (const file of claudeDirs.flatMap(jsonlFiles)) {
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line) continue
        const item = JSON.parse(line)
        if (item.type === 'cost-state' && typeof item.totalCostUSD === 'number') {
          claudeSessions.set(item.sessionId, Math.max(claudeSessions.get(item.sessionId) ?? 0, item.totalCostUSD))
        }
      }
    } catch {}
  }

  const codexSessions = new Map<string, { input: number; output: number }>()
  for (const file of jsonlFiles(join(homedir(), '.codex', 'sessions'))) {
    try {
      let matchesProject = !projectPath
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line) continue
        const item = JSON.parse(line)
        if (item.type === 'session_meta' && projectPath) matchesProject = item.payload?.cwd === projectPath
        if (matchesProject && item.type === 'token_usage_record') {
          const usage = item.payload?.thread_token_usage ?? item.payload?.usage
          const id = item.payload?.thread_id ?? item.payload?.session_id ?? file
          if (usage) {
            const previous = codexSessions.get(id) ?? { input: 0, output: 0 }
            codexSessions.set(id, {
              input: Math.max(previous.input, Number(usage.input_tokens ?? 0)),
              output: Math.max(previous.output, Number(usage.output_tokens ?? 0)),
            })
          }
        }
      }
    } catch {}
  }
  // Approximation for local Codex token logs; ChatGPT-plan usage is not USD billing.
  const codexInputRate = 1.75 / 1_000_000
  const codexOutputRate = 14 / 1_000_000
  const codexTokens = [...codexSessions.values()].reduce((sum, value) => sum + value.input + value.output, 0)
  const codexCost = [...codexSessions.values()].reduce((sum, value) => sum + value.input * codexInputRate + value.output * codexOutputRate, 0)
  return {
    claudeCost: [...claudeSessions.values()].reduce((sum, value) => sum + value, 0),
    codexCost,
    codexTokens,
    codexEstimated: true,
    updatedAt: Date.now(),
  }
})

ipcMain.handle('codex:status', () => ({
  available: codexCandidates.some(candidate => candidate === 'codex' || existsSync(candidate)),
}))

ipcMain.handle('codex:invoke', async (_, { mode, input, context, projectPath }: {
  mode: 'review' | 'plan' | 'research'; input: string; context?: string; projectPath?: string
}) => {
  return new Promise<{ success: boolean; output: string; error: string }>((resolve) => {
    const prompt = mode === 'review'
      ? `You are a precise code reviewer. Respond in Korean using polite formal speech.\n\nReview the following target and use this format:\n## Verdict\n[SHIP | NEEDS-FIX | DISCUSS]\n\n## Findings\n[List severity, file:line, and description]\n\n## What I checked\n[Brief bullets]\n\n<review_target>\n${input}\n</review_target>`
      : mode === 'plan'
        ? `You are a senior software planner. Respond in Korean using polite formal speech. Inspect the project files and current git worktree when useful. Do not change files. Use this format:\n## Goal\n[Desired outcome]\n\n## Current state\n[Relevant architecture, files, and constraints]\n\n## Plan\n[Ordered implementation steps with concrete file paths]\n\n## Risks and decisions\n[Tradeoffs, edge cases, and open questions]\n\n## Verification\n[Commands and checks to run]\n\n<planning_request>\n${input}\n</planning_request>${context ? `\n<planning_context>\n${context}\n</planning_context>` : ''}`
        : `You are a technical researcher. Respond in Korean using polite formal speech. Lead with the direct answer, cite official URLs and versions when relevant, and state uncertainty explicitly.\n\n<user_question>\n${input}\n</user_question>${context ? `\n<research_context>\n${context}\n</research_context>` : ''}`

    const codex = codexCandidates.find(candidate => candidate === 'codex' || existsSync(candidate))
    if (!codex) return resolve({ success: false, output: '', error: 'Codex CLI를 찾을 수 없습니다.' })

    const child = spawnChild(codex, ['exec', '--color', 'never', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '-'], {
      cwd: projectPath || homedir(), stdio: ['pipe', 'pipe', 'pipe'],
    })
    let output = ''
    let error = ''
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
      output += text
      mainWindow?.webContents.send('codex:stream', { chunk: text })
    })
    child.stderr?.on('data', (data: Buffer) => { error += data.toString() })
    child.on('error', err => resolve({ success: false, output, error: err.message }))
    child.on('close', code => resolve({ success: code === 0, output, error: code === 0 ? '' : error || `Codex 종료 코드: ${code}` }))
    child.stdin?.end(prompt)
  })
})

// ─── Local HTTP server (Agy IDE extension → MacKuro) ─────────────────────────

function startHttpServer() {
  httpServer = createServer((req, res) => {
    // CORS 헤더 없음 — 브라우저 교차 출처 접근은 의도적으로 차단.
    // IDE 확장은 Node http로 직접 호출하므로 CORS 불필요.

    if (req.method === 'POST' && req.url === '/inject') {
      if (!isValidToken(req.headers['x-kuro-token'])) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'invalid token' }))
        return
      }
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as {
            code: string
            error?: string
            file?: string
            lines?: string
          }
          mainWindow?.webContents.send('external:inject', payload)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.writeHead(400)
          res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }))
        }
      })
      return
    }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, version: app.getVersion() }))
      return
    }

    res.writeHead(404)
    res.end()
  })

  httpServer.listen(KURO_PORT, '127.0.0.1', () => {
    mainWindow?.webContents.send('server:ready', { port: KURO_PORT })
  })

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      mainWindow?.webContents.send('server:error', `포트 ${KURO_PORT} 이미 사용 중`)
    }
  })
}

ipcMain.handle('server:getPort', () => KURO_PORT)

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Electron uses its own Dock icon in development unless the macOS Dock
  // icon is explicitly overridden. Keep dev and packaged runs branded alike.
  if (process.platform === 'darwin') {
    const dockIcon = join(app.getAppPath(), 'resources', 'icon.png')
    if (existsSync(dockIcon)) app.dock.setIcon(dockIcon)
  }
  createWindow()
  writeTokenFile()
  startHttpServer()
})

app.on('window-all-closed', () => {
  for (const [, pty] of ptys) {
    try { process.kill(-pty.pid, 'SIGTERM') } catch {}
    try { pty.kill() } catch {}
  }
  httpServer?.close()
  try { unlinkSync(join(homedir(), '.kuro', 'token')) } catch {}
  app.quit()
})
