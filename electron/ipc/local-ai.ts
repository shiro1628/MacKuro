import { ipcMain, shell } from 'electron'
import { totalmem } from 'os'
import { COMFYUI_PORT } from '../constants'
import {
  comfyFreeMemory, comfyLogs, comfyOpenDesktop, comfyStart, comfyStatus, comfyStop,
} from './comfyui'
import { run } from './exec'
import {
  ollamaCancelPull, ollamaDelete, ollamaLoad, ollamaPull, ollamaStart, ollamaStatus, ollamaStop, ollamaUnload,
} from './ollama'

export interface MachineStats {
  memTotal: number
  /** Activity Monitor's "Memory Used": app + wired + compressed. */
  memUsed: number
  /** Unified memory the GPU driver currently has in use. */
  gpuMemUsed: number | null
  gpuUtilization: number | null
}

async function machineStats(): Promise<MachineStats> {
  const memTotal = totalmem()
  let memUsed = 0
  try {
    const vm = await run('vm_stat', [])
    const pageSize = Number(vm.match(/page size of (\d+)/)?.[1] ?? 16384)
    const pages = (label: string) => Number(vm.match(new RegExp(`${label}:\\s+(\\d+)`))?.[1] ?? 0)
    memUsed = (pages('Anonymous pages') - pages('Pages purgeable')
      + pages('Pages wired down') + pages('Pages occupied by compressor')) * pageSize
  } catch {}

  let gpuMemUsed: number | null = null
  let gpuUtilization: number | null = null
  try {
    const io = await run('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'])
    const util = io.match(/"Device Utilization %"=(\d+)/)
    const mem = io.match(/"In use system memory"=(\d+)/)
    if (util) gpuUtilization = Number(util[1])
    if (mem) gpuMemUsed = Number(mem[1])
  } catch {}

  return { memTotal, memUsed, gpuMemUsed, gpuUtilization }
}

/** Wrap an action so the renderer gets `{ success, error }` instead of a rejection. */
const action = <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) =>
  async (_: unknown, ...args: A) => {
    try {
      await fn(...args)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message ?? String(error) }
    }
  }

/** Local model servers: Ollama and ComfyUI, plus machine memory/GPU load. */
export function registerLocalAiIpc() {
  ipcMain.handle('localai:status', async () => {
    const [machine, ollama, comfy] = await Promise.all([machineStats(), ollamaStatus(), comfyStatus()])
    return { machine, ollama, comfy }
  })

  ipcMain.handle('ollama:start', action(ollamaStart))
  ipcMain.handle('ollama:stop', action(ollamaStop))
  ipcMain.handle('ollama:load', action((model: string, keepAlive: string | number) => ollamaLoad(model, keepAlive)))
  ipcMain.handle('ollama:unload', action((model: string) => ollamaUnload(model)))
  ipcMain.handle('ollama:delete', action((model: string) => ollamaDelete(model)))
  ipcMain.handle('ollama:pull', action((model: string) => ollamaPull(model)))
  ipcMain.handle('ollama:cancel-pull', (_, model: string) => ollamaCancelPull(model))

  ipcMain.handle('comfy:start', action(comfyStart))
  ipcMain.handle('comfy:stop', action(comfyStop))
  ipcMain.handle('comfy:free', action(comfyFreeMemory))
  ipcMain.handle('comfy:open-desktop', action(comfyOpenDesktop))
  ipcMain.handle('comfy:open-ui', () => shell.openExternal(`http://127.0.0.1:${COMFYUI_PORT}`))
  ipcMain.handle('comfy:logs', () => comfyLogs())
}
