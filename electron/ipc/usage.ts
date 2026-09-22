import { ipcMain } from 'electron'
import { readFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

interface ClaudeSession {
  cost: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

interface CodexSession {
  input: number
  output: number
}

// Per-million-token rates. Claude's are the API-equivalent list prices used
// only when the log has no cost-state; Codex's are an approximation, since
// ChatGPT-plan usage is not USD billing.
const CLAUDE_RATES = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }
const CODEX_RATES = { input: 1.75, output: 14 }
const PER_TOKEN = 1 / 1_000_000

async function jsonlFiles(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return jsonlFiles(path)
    return entry.name.endsWith('.jsonl') ? [path] : []
  }))
  return nested.flat()
}

/**
 * These logs are append-only and there can be thousands of them, so re-parsing
 * every file on each poll is what made the toolbar's 10s refresh expensive.
 * Memoize each file's contribution and reuse it while size and mtime hold.
 */
const fileCache = new Map<string, { size: number; mtimeMs: number; value: unknown }>()

async function parseFile<T>(file: string, parse: (records: any[]) => T): Promise<T | null> {
  try {
    const { size, mtimeMs } = await stat(file)
    const cached = fileCache.get(file)
    if (cached && cached.size === size && cached.mtimeMs === mtimeMs) return cached.value as T

    const records: any[] = []
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
      if (!line) continue
      try { records.push(JSON.parse(line)) } catch {}
    }
    const value = parse(records)
    fileCache.set(file, { size, mtimeMs, value })
    return value
  } catch {
    return null
  }
}

/**
 * Claude Code names each project's log directory after its path with every
 * character outside [A-Za-z0-9-] replaced by a dash — not just the slashes.
 * Getting this wrong silently falls back to scanning every project, which is
 * how per-project usage ended up reporting the machine-wide total.
 */
const projectDirName = (projectPath: string) => projectPath.replace(/[^a-zA-Z0-9-]/g, '-')

async function readClaudeSessions(projectPath?: string): Promise<ClaudeSession[]> {
  const claudeRoot = join(homedir(), '.claude', 'projects')
  const projectDir = projectPath ? join(claudeRoot, projectDirName(projectPath)) : ''
  const root = projectDir && existsSync(projectDir) ? projectDir : claudeRoot

  const perFile = await Promise.all((await jsonlFiles(root)).map(file =>
    parseFile(file, records => {
      const sessions = new Map<string, ClaudeSession>()
      for (const item of records) {
        const sessionId = item.sessionId ?? file
        const previous = sessions.get(sessionId) ?? { cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        if (item.type === 'cost-state' && typeof item.totalCostUSD === 'number') {
          previous.cost = Math.max(previous.cost, item.totalCostUSD)
        }
        if (item.type === 'assistant' && item.message?.usage) {
          const usage = item.message.usage
          previous.input += Number(usage.input_tokens ?? 0)
          previous.output += Number(usage.output_tokens ?? 0)
          previous.cacheRead += Number(usage.cache_read_input_tokens ?? 0)
          previous.cacheWrite += Number(usage.cache_creation_input_tokens ?? 0)
        }
        sessions.set(sessionId, previous)
      }
      return [...sessions.values()]
    })))

  return perFile.flatMap(value => value ?? [])
}

async function readCodexSessions(projectPath?: string): Promise<CodexSession[]> {
  const files = await jsonlFiles(join(homedir(), '.codex', 'sessions'))
  const perFile = await Promise.all(files.map(file =>
    parseFile(file, records => {
      const sessions = new Map<string, CodexSession>()
      let matchesProject = !projectPath
      for (const item of records) {
        if (item.type === 'session_meta' && projectPath) matchesProject = item.payload?.cwd === projectPath
        if (matchesProject && item.type === 'token_usage_record') {
          const usage = item.payload?.thread_token_usage ?? item.payload?.usage
          const id = item.payload?.thread_id ?? item.payload?.session_id ?? file
          if (usage) {
            const previous = sessions.get(id) ?? { input: 0, output: 0 }
            sessions.set(id, {
              input: Math.max(previous.input, Number(usage.input_tokens ?? 0)),
              output: Math.max(previous.output, Number(usage.output_tokens ?? 0)),
            })
          }
        }
      }
      return [...sessions.values()]
    })))

  return perFile.flatMap(value => value ?? [])
}

const sum = <T>(values: T[], pick: (value: T) => number) =>
  values.reduce((total, value) => total + pick(value), 0)

/** Cumulative Claude + Codex spend, read from the CLIs' own local logs. */
export function registerUsageIpc() {
  ipcMain.handle('usage:summary', async (_, { projectPath }: { projectPath?: string }) => {
    const [claudeSessions, codexSessions] = await Promise.all([
      readClaudeSessions(projectPath),
      readCodexSessions(projectPath),
    ])

    // Claude Code subscription logs often report cost-state as zero. In that
    // case show a clearly estimated API-equivalent amount from usage records.
    const claudeEstimated = claudeSessions.some(value => value.cost === 0 && value.input + value.output > 0)
    const claudeCost = sum(claudeSessions, value => value.cost > 0
      ? value.cost
      : PER_TOKEN * (
          value.input * CLAUDE_RATES.input
          + value.output * CLAUDE_RATES.output
          + value.cacheRead * CLAUDE_RATES.cacheRead
          + value.cacheWrite * CLAUDE_RATES.cacheWrite
        ))

    return {
      claudeCost,
      claudeEstimated,
      claudeTokens: sum(claudeSessions, v => v.input + v.output + v.cacheRead + v.cacheWrite),
      claudeInputTokens: sum(claudeSessions, v => v.input),
      claudeOutputTokens: sum(claudeSessions, v => v.output),
      codexCost: sum(codexSessions, v => PER_TOKEN * (v.input * CODEX_RATES.input + v.output * CODEX_RATES.output)),
      codexTokens: sum(codexSessions, v => v.input + v.output),
      codexEstimated: true,
      updatedAt: Date.now(),
    }
  })
}
