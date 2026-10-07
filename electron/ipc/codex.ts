import { ipcMain } from 'electron'
import { spawn as spawnChild } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { delimiter, join } from 'path'
import { send } from '../window'
import { buildPrompt, type CodexMode } from './codex-prompts'

const CODEX_CANDIDATES = [
  // ChatGPT.app moved its bundled CLI here (Oct 2026); the flat path is older builds.
  '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
  '/Applications/ChatGPT.app/Contents/Resources/codex',
  join(homedir(), '.local', 'bin', 'codex'),
  '/opt/homebrew/bin/codex',
  '/usr/local/bin/codex',
]

/**
 * Resolve to a real file. A bare `codex` fallback used to count as found
 * unconditionally, so a moved binary surfaced only as `spawn codex ENOENT`
 * while the toolbar still reported Codex as available.
 */
const findCodex = () =>
  CODEX_CANDIDATES.find(existsSync)
  ?? (process.env.PATH ?? '').split(delimiter).filter(Boolean).map(dir => join(dir, 'codex')).find(existsSync)

const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')

/**
 * stderr carries the banner, the echoed prompt (the whole plan template) and
 * warnings ahead of the actual failure. Show only the ERROR lines when there are any.
 */
function failureReason(stderr: string): string {
  const errors = [...new Set(stderr.split('\n').map(l => l.trim()).filter(l => /^ERROR\b/.test(l)))]
  if (errors.length) return errors.map(l => l.replace(/^ERROR:?\s*/, '')).join('\n')
  return stderr.trim().split('\n').slice(-20).join('\n')
}

export function registerCodexIpc() {
  ipcMain.handle('codex:status', () => ({ available: !!findCodex() }))

  ipcMain.handle('codex:invoke', async (_, { mode, input, context, projectPath, streamId }: {
    mode: CodexMode; input: string; context?: string; projectPath?: string; streamId?: string
  }) => {
    return new Promise<{ success: boolean; output: string; error: string }>(resolve => {
      const codex = findCodex()
      if (!codex) return resolve({ success: false, output: '', error: `Codex CLI를 찾을 수 없습니다. 확인한 경로: ${CODEX_CANDIDATES.join(', ')}` })

      const child = spawnChild(codex, ['exec', '--color', 'never', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '-'], {
        cwd: projectPath || homedir(), stdio: ['pipe', 'pipe', 'pipe'],
      })

      let output = ''
      let error = ''
      child.stdout?.on('data', (data: Buffer) => {
        const text = stripAnsi(data.toString())
        output += text
        send('codex:stream', { chunk: text, streamId })
      })
      child.stderr?.on('data', (data: Buffer) => { error += stripAnsi(data.toString()) })
      child.on('error', err => resolve({ success: false, output, error: err.message }))
      child.on('close', code => {
        // codex writes its banner and its failures to stderr, so a spend-cap or
        // auth failure exits with empty stdout. Treat "no output at all" as a
        // failure too, otherwise the panel just renders a blank entry.
        if (code === 0 && output.trim()) return resolve({ success: true, output, error: '' })
        const reason = failureReason(error) || `Codex 종료 코드: ${code}`
        resolve({ success: false, output, error: reason })
      })
      child.stdin?.end(buildPrompt(mode, input, context))
    })
  })
}
