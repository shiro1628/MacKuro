import { ipcMain } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const DEV_SCRIPTS = ['dev', 'start', 'serve', 'preview']

export function registerDevServerIpc() {
  ipcMain.handle('devserver:detect', async (_, { projectPath }: { projectPath: string }) => {
    try {
      const pkgPath = join(projectPath, 'package.json')
      if (!existsSync(pkgPath)) return null
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const scripts: Record<string, string> = pkg.scripts ?? {}
      for (const name of DEV_SCRIPTS) {
        if (scripts[name]) return { name, script: `npm run ${name}` }
      }
      return null
    } catch {
      return null
    }
  })
}
