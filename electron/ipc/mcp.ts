import { ipcMain } from 'electron'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Set by the shared-browser handlers; decides whether Playwright MCP attaches
// to MacKuro's browser or launches its own.
let browserCdpEndpoint: string | null = null

export function getCdpEndpoint(): string | null {
  return browserCdpEndpoint
}

export function setCdpEndpoint(endpoint: string | null) {
  browserCdpEndpoint = endpoint
}

const claudeJsonPath = () => join(homedir(), '.claude.json')

/**
 * ~/.claude.json holds the user's whole Claude Code config, so a partial write
 * is data loss. Write a sibling temp file and rename it over the original —
 * rename is atomic within a filesystem, so the file is never half-written.
 */
function writeJsonAtomic(path: string, value: unknown) {
  const temp = `${path}.kuro-${process.pid}.tmp`
  try {
    writeFileSync(temp, JSON.stringify(value, null, 2), 'utf-8')
    renameSync(temp, path)
  } catch (err) {
    try { unlinkSync(temp) } catch {}
    throw err
  }
}

export function injectMcp() {
  // Write to top-level mcpServers in ~/.claude.json — no path-matching issues
  const path = claudeJsonPath()

  let root: Record<string, any> = {}
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf-8')
    try {
      root = JSON.parse(raw)
    } catch {
      // Unparseable but non-empty means we do not understand the file. Bailing
      // out keeps it intact; overwriting would discard the user's whole config.
      if (raw.trim()) throw new Error('~/.claude.json을 파싱할 수 없어 MCP 설정을 건너뜁니다.')
    }
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

  writeJsonAtomic(path, root)
  console.log('[mcp:inject] playwright →', playwrightArgs.join(' '))
}

export function registerMcpIpc() {
  ipcMain.handle('mcp:inject', async () => {
    try {
      injectMcp()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
