import { registerAgyIdeIpc } from './agy-ide'
import { registerBrowserIpc } from './browser'
import { registerCodexIpc } from './codex'
import { registerDevServerIpc } from './devserver'
import { registerGitIpc } from './git'
import { registerMcpIpc } from './mcp'
import { registerPtyIpc } from './pty'
import { registerSystemIpc } from './system'
import { registerUsageIpc } from './usage'

/** Wire every IPC channel the renderer can reach. */
export function registerIpc() {
  registerPtyIpc()
  registerAgyIdeIpc()
  registerSystemIpc()
  registerMcpIpc()
  registerBrowserIpc()
  registerGitIpc()
  registerDevServerIpc()
  registerCodexIpc()
  registerUsageIpc()
}
