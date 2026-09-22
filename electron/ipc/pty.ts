import { ipcMain } from 'electron'
import * as nodePty from 'node-pty'
import { send } from '../window'

// Renderer can only request the user's approved login shells.
const PTY_ALLOWED_COMMANDS = new Set(['/bin/zsh', '/bin/bash', 'zsh', 'bash'])

const ptys = new Map<string, nodePty.IPty>()

/** PTYs are process-group leaders on macOS; terminate the whole group. */
function killPty(pty: nodePty.IPty) {
  try { process.kill(-pty.pid, 'SIGTERM') } catch {}
  try { pty.kill() } catch {}
}

export function killAllPtys() {
  for (const [, pty] of ptys) killPty(pty)
}

export function registerPtyIpc() {
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
      pty.onData(data => send('pty:data', { id, data }))
      pty.onExit(({ exitCode }) => {
        send('pty:exit', { id, exitCode })
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
      killPty(pty)
      ptys.delete(id)
    }
  })
}
