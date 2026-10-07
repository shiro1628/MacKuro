import { spawn as spawnChild, type ChildProcess } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { COMFYUI_PORT } from '../constants'
import { run } from './exec'

const COMFYUI_URL = `http://127.0.0.1:${COMFYUI_PORT}`
const DESKTOP_APP = '/Applications/Comfy Desktop.app'
const DESKTOP_DATA = join(homedir(), 'Library', 'Application Support', 'Comfy Desktop')
const LOG_LIMIT = 400

export interface ComfyStatus {
  running: boolean
  /** True when MacKuro spawned the server itself (and so owns its logs). */
  managed: boolean
  installed: boolean
  desktopApp: boolean
  installPath?: string
  version?: string
  device?: string
  vramTotal?: number
  vramFree?: number
  ramTotal?: number
  ramFree?: number
  queueRunning?: number
  queuePending?: number
  url: string
}

interface ComfyInstall {
  installPath: string
  python: string
  mainPy: string
  args: string[]
}

/**
 * Comfy Desktop keeps its installs, shared model folders and I/O directories
 * in its own config. Reusing it means the headless server sees exactly the
 * models and outputs the Desktop app does.
 */
function findInstall(): ComfyInstall | null {
  try {
    const installs: any[] = JSON.parse(readFileSync(join(DESKTOP_DATA, 'installations.json'), 'utf8'))
    const settings = JSON.parse(readFileSync(join(DESKTOP_DATA, 'settings.json'), 'utf8'))
    let lastId: string | undefined
    try { lastId = JSON.parse(readFileSync(join(DESKTOP_DATA, 'last-session.json'), 'utf8')).installationId } catch {}

    const local = installs.filter(i => i.installPath && i.sourceId !== 'cloud' && existsSync(i.installPath))
    const install = local.find(i => i.id === lastId) ?? local[0]
    if (!install) return null

    // The standalone env is only the base interpreter; torch and the other
    // packages live in the venv Desktop creates inside the ComfyUI checkout.
    const python = [
      join(install.installPath, 'ComfyUI', '.venv', 'bin', 'python3'),
      join(install.installPath, 'standalone-env', 'bin', 'python3'),
    ].find(existsSync)
    const mainPy = join(install.installPath, 'ComfyUI', 'main.py')
    if (!python || !existsSync(mainPy)) return null

    const args = [mainPy, '--listen', '127.0.0.1', '--port', String(COMFYUI_PORT)]
    args.push(...String(install.launchArgs ?? '').split(/\s+/).filter(Boolean))
    const modelPaths = join(DESKTOP_DATA, 'instance-model-paths', `${install.id}.yaml`)
    if (existsSync(modelPaths)) args.push('--extra-model-paths-config', modelPaths)
    if (settings.inputDir) args.push('--input-directory', settings.inputDir)
    if (settings.outputDir) args.push('--output-directory', settings.outputDir)

    return { installPath: install.installPath, python, mainPy, args }
  } catch {
    return null
  }
}

let comfyProc: ChildProcess | null = null
const logs: string[] = []

function appendLog(chunk: Buffer) {
  // Strip ANSI colour codes; the panel renders plain text.
  for (const line of chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
    if (line.trim()) logs.push(line)
  }
  if (logs.length > LOG_LIMIT) logs.splice(0, logs.length - LOG_LIMIT)
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${COMFYUI_URL}${path}`, { ...init, signal: AbortSignal.timeout(2000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function comfyStatus(): Promise<ComfyStatus> {
  const install = findInstall()
  const base = {
    managed: !!comfyProc,
    installed: !!install,
    desktopApp: existsSync(DESKTOP_APP),
    installPath: install?.installPath,
    url: COMFYUI_URL,
  }
  try {
    const [stats, queue] = await Promise.all([
      api<any>('/system_stats'),
      api<any>('/queue').catch(() => null),
    ])
    const device = stats.devices?.[0]
    return {
      ...base,
      running: true,
      version: stats.system?.comfyui_version,
      device: device?.type,
      vramTotal: device?.vram_total,
      vramFree: device?.vram_free,
      ramTotal: stats.system?.ram_total,
      ramFree: stats.system?.ram_free,
      queueRunning: queue?.queue_running?.length ?? 0,
      queuePending: queue?.queue_pending?.length ?? 0,
    }
  } catch {
    return { ...base, running: false }
  }
}

async function waitFor(running: boolean, timeoutMs: number, giveUp = () => false) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await comfyStatus()).running === running) return true
    if (giveUp()) return false
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

export async function comfyStart(): Promise<void> {
  if ((await comfyStatus()).running) return
  const install = findInstall()
  if (!install) throw new Error('ComfyUI 설치를 찾을 수 없습니다 (Comfy Desktop에서 먼저 설치하세요).')

  logs.length = 0
  const env: NodeJS.ProcessEnv = { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: '1' }
  delete env.ELECTRON_RUN_AS_NODE
  comfyProc = spawnChild(install.python, install.args, { cwd: join(install.installPath, 'ComfyUI'), env, stdio: 'pipe' })
  comfyProc.stdout?.on('data', appendLog)
  comfyProc.stderr?.on('data', appendLog)
  comfyProc.on('exit', code => {
    logs.push(`[MacKuro] ComfyUI 종료 (code ${code})`)
    comfyProc = null
  })

  // First launch after an update can spend a while migrating and scanning nodes.
  const child = comfyProc
  if (!await waitFor(true, 120_000, () => child.exitCode !== null)) {
    throw new Error(child.exitCode === null ? 'ComfyUI 시작 시간 초과' : 'ComfyUI가 시작 중 종료되었습니다 — 로그를 확인하세요.')
  }
}

/** Stops our own server, or whichever process is listening on the port. */
export async function comfyStop(): Promise<void> {
  if (comfyProc) {
    comfyProc.kill('SIGTERM')
  } else {
    const pids = (await run('lsof', ['-ti', `tcp:${COMFYUI_PORT}`, '-sTCP:LISTEN']).catch(() => ''))
      .split('\n').map(Number).filter(Boolean)
    if (pids.length === 0) return
    for (const pid of pids) process.kill(pid, 'SIGTERM')
  }
  if (!await waitFor(false, 15_000)) throw new Error('ComfyUI가 종료되지 않았습니다.')
}

/** Asks ComfyUI to drop loaded models and release cached memory. */
export async function comfyFreeMemory(): Promise<void> {
  const res = await fetch(`${COMFYUI_URL}/free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unload_models: true, free_memory: true }),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export async function comfyOpenDesktop(): Promise<void> {
  await run('open', ['-a', DESKTOP_APP])
}

export function comfyLogs(): string[] {
  return [...logs]
}

/** Called on app quit so a server we spawned does not outlive MacKuro. */
export function stopManagedComfy() {
  comfyProc?.kill('SIGTERM')
  comfyProc = null
}
