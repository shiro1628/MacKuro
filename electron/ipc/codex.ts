import { ipcMain } from 'electron'
import { spawn as spawnChild } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { send } from '../window'
import { buildPrompt, type CodexMode } from './codex-prompts'

const CODEX_CANDIDATES = [
  '/Applications/ChatGPT.app/Contents/Resources/codex',
  join(homedir(), '.local', 'bin', 'codex'),
  'codex',
]

// The bare name is a PATH lookup, so it always counts as a candidate.
const findCodex = () =>
  CODEX_CANDIDATES.find(candidate => candidate === 'codex' || existsSync(candidate))

const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')

export function registerCodexIpc() {
  ipcMain.handle('codex:status', () => ({ available: !!findCodex() }))

  ipcMain.handle('codex:invoke', async (_, { mode, input, context, projectPath }: {
    mode: CodexMode; input: string; context?: string; projectPath?: string
  }) => {
    return new Promise<{ success: boolean; output: string; error: string }>(resolve => {
      const codex = findCodex()
      if (!codex) return resolve({ success: false, output: '', error: 'Codex CLI를 찾을 수 없습니다.' })

      const child = spawnChild(codex, ['exec', '--color', 'never', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '-'], {
        cwd: projectPath || homedir(), stdio: ['pipe', 'pipe', 'pipe'],
      })

      let output = ''
      let error = ''
      child.stdout?.on('data', (data: Buffer) => {
        const text = stripAnsi(data.toString())
        output += text
        send('codex:stream', { chunk: text })
      })
      child.stderr?.on('data', (data: Buffer) => { error += stripAnsi(data.toString()) })
      child.on('error', err => resolve({ success: false, output, error: err.message }))
      child.on('close', code => {
        // codex writes its banner and its failures to stderr, so a spend-cap or
        // auth failure exits with empty stdout. Treat "no output at all" as a
        // failure too, otherwise the panel just renders a blank entry.
        if (code === 0 && output.trim()) return resolve({ success: true, output, error: '' })
        const reason = error.trim() || `Codex 종료 코드: ${code}`
        resolve({ success: false, output, error: reason })
      })
      child.stdin?.end(buildPrompt(mode, input, context))
    })
  })
}
