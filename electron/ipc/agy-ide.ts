import { ipcMain } from 'electron'
import { spawn as spawnChild } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

// Antigravity ships two separate bundles: the agent hub (`Antigravity.app`,
// a small tray app with no editor) and the VS Code-derived editor
// (`Antigravity IDE.app`). Only the editor can open a project folder, and only
// it ships a `code`-style CLI launcher under Contents/Resources/app/bin.
const AGY_BUNDLES = ['/Applications/Antigravity IDE.app', '/Applications/Antigravity.app']

// The `code`-style launcher that hands a folder to a running window.
function findAgyCli(appPath: string): string | null {
  const binDir = join(appPath, 'Contents', 'Resources', 'app', 'bin')
  if (!existsSync(binDir)) return null
  const entry = readdirSync(binDir, { withFileTypes: true })
    .find(item => item.isFile() && !item.name.startsWith('.'))
  return entry ? join(binDir, entry.name) : null
}

// Prefer whichever installed bundle ships a CLI — that is the editor.
function findAgyIde(): { appPath: string; cli: string | null } | null {
  const installed = AGY_BUNDLES.filter(existsSync)
  if (installed.length === 0) return null
  for (const appPath of installed) {
    const cli = findAgyCli(appPath)
    if (cli) return { appPath, cli }
  }
  return { appPath: installed[0], cli: null }
}

export function registerAgyIdeIpc() {
  ipcMain.handle('agy-ide:open', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const ide = findAgyIde()
      if (!ide) return { success: false, error: 'Antigravity IDE를 찾을 수 없습니다.' }

      if (ide.cli) {
        // The CLI re-execs the app with ELECTRON_RUN_AS_NODE. MacKuro is itself
        // an Electron app, so drop the Electron vars we would otherwise pass on.
        const env = { ...process.env }
        delete env.ELECTRON_RUN_AS_NODE
        delete env.ELECTRON_NO_ATTACH_CONSOLE
        spawnChild(ide.cli, [projectPath], { stdio: 'ignore', detached: true, env }).unref()
      } else {
        // No CLI: fall back to LaunchServices. This only carries the folder when
        // the bundle declares CFBundleDocumentTypes — otherwise the app merely
        // comes to the front, which is the old behaviour.
        spawnChild('open', ['-a', ide.appPath, projectPath], { stdio: 'ignore', detached: true }).unref()
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('agy-ide:running', async () => {
    const ide = findAgyIde()
    if (!ide) return false
    // Match the bundle the button actually opens. A bare `-f Antigravity` also
    // matches the hub app, which would light the indicator for the wrong app.
    const executable = join(ide.appPath, 'Contents', 'MacOS')
    return new Promise<boolean>(resolve => {
      const child = spawnChild('pgrep', ['-f', executable], { stdio: 'ignore' })
      child.on('close', code => resolve(code === 0))
      child.on('error', () => resolve(false))
    })
  })
}
