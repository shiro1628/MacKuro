import { spawn as spawnChild } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { OLLAMA_URL } from '../constants'
import { send } from '../window'
import { run } from './exec'

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  parameterSize?: string
  quantization?: string
}

export interface OllamaLoadedModel {
  name: string
  size: number
  sizeVram: number
  expiresAt: string
}

export interface OllamaStatus {
  running: boolean
  version?: string
  /** How MacKuro would start/stop the server on this machine. */
  manager: 'brew' | 'app' | 'cli' | 'none'
  models: OllamaModel[]
  loaded: OllamaLoadedModel[]
}

const BREW_CANDIDATES = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']
const OLLAMA_CANDIDATES = ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama', '/Applications/Ollama.app/Contents/Resources/ollama']
const OLLAMA_APP = '/Applications/Ollama.app'
// Older Homebrew names the agent homebrew.mxcl.*, newer ones sh.brew.*.
const BREW_PLISTS = ['sh.brew.ollama.plist', 'homebrew.mxcl.ollama.plist']
  .map(name => join(homedir(), 'Library', 'LaunchAgents', name))

const brew = () => BREW_CANDIDATES.find(existsSync)
const ollamaCli = () => OLLAMA_CANDIDATES.find(existsSync)

/**
 * Prefer whatever already owns the server. A brew-managed launchd agent has
 * KeepAlive, so killing its process would just respawn it — it has to be
 * stopped through `brew services`.
 */
function detectManager(): OllamaStatus['manager'] {
  if (brew() && BREW_PLISTS.some(existsSync)) return 'brew'
  if (existsSync(OLLAMA_APP)) return 'app'
  // Installed by brew but never run as a service: brew services creates the agent.
  if (brew() && ollamaCli()?.startsWith('/opt/homebrew')) return 'brew'
  if (ollamaCli()) return 'cli'
  return 'none'
}

async function api<T>(path: string, init?: RequestInit, timeoutMs = 2000): Promise<T> {
  const res = await fetch(`${OLLAMA_URL}${path}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error((await res.text()).trim() || `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function ollamaStatus(): Promise<OllamaStatus> {
  const manager = detectManager()
  try {
    const [{ version }, tags, ps] = await Promise.all([
      api<{ version: string }>('/api/version'),
      api<{ models: any[] }>('/api/tags'),
      api<{ models: any[] }>('/api/ps'),
    ])
    return {
      running: true,
      version,
      manager,
      models: (tags.models ?? []).map(m => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
      })),
      loaded: (ps.models ?? []).map(m => ({
        name: m.name,
        size: m.size,
        sizeVram: m.size_vram ?? 0,
        expiresAt: m.expires_at,
      })),
    }
  } catch {
    return { running: false, manager, models: [], loaded: [] }
  }
}

async function waitFor(running: boolean, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await ollamaStatus()).running === running) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

export async function ollamaStart(): Promise<void> {
  const manager = detectManager()
  if (manager === 'brew') await run(brew()!, ['services', 'start', 'ollama'])
  else if (manager === 'app') await run('open', ['-a', OLLAMA_APP])
  else if (manager === 'cli') spawnChild(ollamaCli()!, ['serve'], { stdio: 'ignore', detached: true }).unref()
  else throw new Error('Ollama가 설치되어 있지 않습니다 (brew install ollama).')
  if (!await waitFor(true)) throw new Error('Ollama 서버가 응답하지 않습니다.')
}

export async function ollamaStop(): Promise<void> {
  const manager = detectManager()
  if (manager === 'brew') await run(brew()!, ['services', 'stop', 'ollama'])
  else if (manager === 'app') await run('osascript', ['-e', 'quit app "Ollama"'])
  else await run('pkill', ['-f', 'ollama serve']).catch(() => undefined)
  if (!await waitFor(false)) throw new Error('Ollama 서버가 종료되지 않았습니다.')
}

/** An empty generate request loads the weights without producing tokens. */
export async function ollamaLoad(model: string, keepAlive: string | number): Promise<void> {
  await api('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model, prompt: '', keep_alive: keepAlive, stream: false }),
  }, 5 * 60_000)
}

export async function ollamaUnload(model: string): Promise<void> {
  await api('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model, prompt: '', keep_alive: 0, stream: false }),
  }, 30_000)
}

export async function ollamaDelete(model: string): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/delete`, { method: 'DELETE', body: JSON.stringify({ model }) })
  if (!res.ok) throw new Error((await res.text()).trim() || `HTTP ${res.status}`)
}

const pulls = new Map<string, AbortController>()

/** Streams `/api/pull` progress to the renderer as `ollama:pull-progress`. */
export async function ollamaPull(model: string): Promise<void> {
  if (pulls.has(model)) throw new Error(`${model} 다운로드가 이미 진행 중입니다.`)
  const controller = new AbortController()
  pulls.set(model, controller)
  const emit = (payload: { status: string; completed?: number; total?: number; done?: boolean; error?: string }) =>
    send('ollama:pull-progress', { model, ...payload })

  try {
    const res = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ model, stream: true }),
      signal: controller.signal,
    })
    if (!res.ok || !res.body) throw new Error((await res.text()).trim() || `HTTP ${res.status}`)

    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.error) throw new Error(event.error)
        emit({ status: event.status, completed: event.completed, total: event.total })
      }
    }
    emit({ status: 'success', done: true })
  } catch (error: any) {
    const message = controller.signal.aborted ? '취소됨' : error.message
    emit({ status: 'error', done: true, error: message })
    throw new Error(message)
  } finally {
    pulls.delete(model)
  }
}

export function ollamaCancelPull(model: string) {
  pulls.get(model)?.abort()
}
