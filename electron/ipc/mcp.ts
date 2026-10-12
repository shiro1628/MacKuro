import { app } from 'electron'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/**
 * Playwright MCP is handed only to the Claude sessions MacKuro starts, via
 * `claude --mcp-config "$KURO_MCP_CONFIG"`. Nothing is written to
 * ~/.claude.json: that file is shared by every Claude session on the machine
 * (and rewritten by Claude itself), so editing it leaked MacKuro's browser
 * into unrelated sessions and could race with Claude's own writes.
 */
export const MCP_CONFIG_ENV = 'KURO_MCP_CONFIG'

const PLAYWRIGHT_MCP = '@playwright/mcp@latest'

// Set by the shared-browser handlers; decides whether Playwright MCP attaches
// to MacKuro's browser or launches its own.
let browserCdpEndpoint: string | null = null

export function getCdpEndpoint(): string | null {
  return browserCdpEndpoint
}

export function setCdpEndpoint(endpoint: string | null) {
  browserCdpEndpoint = endpoint
  writeMcpConfig()
}

const mcpConfigPath = () => join(app.getPath('userData'), 'kuro-mcp.json')

/** Write a sibling temp file and rename it over the target, so readers never see half a file. */
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

/** Rewrite MacKuro's MCP config; Claude sessions started from now on pick it up. */
export function writeMcpConfig() {
  const args = browserCdpEndpoint
    ? ['-y', PLAYWRIGHT_MCP, '--cdp-endpoint', browserCdpEndpoint]
    : ['-y', PLAYWRIGHT_MCP]
  writeJsonAtomic(mcpConfigPath(), { mcpServers: { playwright: { command: 'npx', args } } })
  console.log('[mcp] playwright →', args.join(' '))
}

/**
 * Older MacKuro versions wrote `mcpServers.playwright` into ~/.claude.json.
 * Remove that entry, but only when it is exactly what MacKuro wrote, so a
 * user's own Playwright setup is never touched.
 */
function removeLegacyGlobalEntry() {
  const path = join(homedir(), '.claude.json')
  if (!existsSync(path)) return
  let root: Record<string, any>
  try { root = JSON.parse(readFileSync(path, 'utf-8')) } catch { return }

  const entry = root?.mcpServers?.playwright
  const args: unknown = entry?.args
  const ours = entry
    && entry.command === 'npx'
    && entry.disabled === false
    && Object.keys(entry).length === 3
    && Array.isArray(args)
    && args[0] === '-y' && args[1] === PLAYWRIGHT_MCP
    && (args.length === 2 || (args.length === 4 && args[2] === '--cdp-endpoint'))
  if (!ours) return

  delete root.mcpServers.playwright
  writeJsonAtomic(path, root)
  console.log('[mcp] removed legacy MacKuro playwright entry from ~/.claude.json')
}

/** Prepare the MCP config before any Claude session starts. */
export function initMcpConfig() {
  process.env[MCP_CONFIG_ENV] = mcpConfigPath()
  writeMcpConfig()
  try { removeLegacyGlobalEntry() } catch (err) { console.error('[mcp] legacy cleanup failed', err) }
}
