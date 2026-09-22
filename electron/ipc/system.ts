import { clipboard, dialog, ipcMain } from 'electron'
import { getMainWindow } from '../window'

/** Clipboard and native dialogs. */
export function registerSystemIpc() {
  ipcMain.handle('clipboard:read', () => clipboard.readText())

  ipcMain.handle('clipboard:write', (_, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const window = getMainWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: '프로젝트 폴더 선택',
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
