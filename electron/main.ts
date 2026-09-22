import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { registerServerIpc, startHttpServer, stopHttpServer } from './http-server'
import { registerIpc } from './ipc'
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
  createWindow()
  writeTokenFile()
  startHttpServer()
})

app.on('window-all-closed', () => {
  killAllPtys()
  stopHttpServer()
  removeTokenFile()
  app.quit()
})
