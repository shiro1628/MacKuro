import { registerAgyIdeIpc } from './agy-ide'
import { registerBrowserIpc } from './browser'
import { registerCodexIpc } from './codex'
import { registerDevServerIpc } from './devserver'
import { registerGitIpc } from './git'
import { registerLocalAiIpc } from './local-ai'
import { registerPtyIpc } from './pty'
import { registerSystemIpc } from './system'
import { registerUsageIpc } from './usage'

/** Wire every IPC channel the renderer can reach. */
export function registerIpc() {
  registerPtyIpc()
  registerAgyIdeIpc()
  registerSystemIpc()
  registerBrowserIpc()
  registerGitIpc()
  registerDevServerIpc()
  registerCodexIpc()
  registerUsageIpc()
  registerLocalAiIpc()
}
