import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { registerServerIpc, startHttpServer, stopHttpServer } from './http-server'
import { registerIpc } from './ipc'
import { stopBrowser } from './ipc/browser'
import { stopManagedComfy } from './ipc/comfyui'
import { initMcpConfig } from './ipc/mcp'
import { killAllPtys } from './ipc/pty'
import { removeTokenFile, writeTokenFile } from './token'
import { createWindow } from './window'

// Electron's development bundle is normally labelled "Electron" by macOS.
// Set the product name as early as possible so the Dock/menu identify MacKuro.
if (process.platform === 'darwin') app.setName('MacKuro')

registerIpc()
registerServerIpc()

app.whenReady().then(() => {
  // Electron uses its own Dock icon in development unless the macOS Dock
  // icon is explicitly overridden. Keep dev and packaged runs branded alike.
  if (process.platform === 'darwin') {
    const dockIcon = join(app.getAppPath(), 'resources', 'icon.png')
    if (existsSync(dockIcon)) app.dock?.setIcon(dockIcon)
  }
  initMcpConfig()
  createWindow()
  writeTokenFile()
  startHttpServer()
})

let cleanedUp = false
/** Stop everything MacKuro started. ⌘Q skips window-all-closed, so this also runs on will-quit. */
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  killAllPtys()
  stopBrowser()
  stopManagedComfy()
  stopHttpServer()
  removeTokenFile()
}

app.on('window-all-closed', () => {
  cleanup()
  app.quit()
})

app.on('will-quit', cleanup)
