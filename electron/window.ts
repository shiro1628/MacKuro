import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/** Push an event to the renderer. A no-op once the window is gone. */
export function send(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args)
}

export function createWindow() {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1440, Math.max(1180, workAreaWidth - 80))
  const height = Math.min(900, Math.max(720, workAreaHeight - 80))

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1180,
    minHeight: 720,
    center: true,
    show: false,
    backgroundColor: '#0f0f0f',
    icon: existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f0f',
      symbolColor: '#888888',
      height: 32,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('closed', () => { mainWindow = null })
}
