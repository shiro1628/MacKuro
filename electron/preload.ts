import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('kuro', {
  // PTY
  ptySpawn: (opts: { id: string; cwd: string; command: string; args?: string[] }) =>
    ipcRenderer.invoke('pty:spawn', opts),
  ptyWrite: (id: string, data: string) =>
    ipcRenderer.send('pty:write', { id, data }),
  ptyResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty:resize', { id, cols, rows }),
  ptyKill: (id: string) =>
    ipcRenderer.invoke('pty:kill', { id }),
  onPtyData: (cb: (id: string, data: string) => void) => {
    const fn = (_: Electron.IpcRendererEvent, { id, data }: { id: string; data: string }) => cb(id, data)
    ipcRenderer.on('pty:data', fn)
    return () => ipcRenderer.off('pty:data', fn)
  },
  onPtyExit: (cb: (id: string, code: number) => void) => {
    const fn = (_: Electron.IpcRendererEvent, { id, exitCode }: { id: string; exitCode: number }) => cb(id, exitCode)
    ipcRenderer.on('pty:exit', fn)
    return () => ipcRenderer.off('pty:exit', fn)
  },

  // Antigravity IDE
  agyIdeOpen: (opts: { projectPath: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('agy-ide:open', opts),
  agyIdeRunning: (): Promise<boolean> => ipcRenderer.invoke('agy-ide:running'),

  // Clipboard
  clipboardRead: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  clipboardWrite: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text),

  // Dialog
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),

  // MCP
  mcpInject: (projectPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('mcp:inject', { projectPath }),

  // Git
  gitDiff: (projectPath: string): Promise<{ diff: string; empty: boolean }> =>
    ipcRenderer.invoke('git:diff', { projectPath }),
  gitStatus: (projectPath: string): Promise<{ branch: string; files: { code: string; path: string }[]; summary: string }> =>
    ipcRenderer.invoke('git:status', { projectPath }),
  gitWorktreeAdd: (projectPath: string, branchName: string): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('git:worktree-add', { projectPath, branchName }),

  // Dev server
  devserverDetect: (projectPath: string): Promise<{ name: string; script: string } | null> =>
    ipcRenderer.invoke('devserver:detect', { projectPath }),

  // Codex CLI (codex)
  codexInvoke: (opts: { mode: 'review' | 'plan' | 'research'; input: string; context?: string; projectPath?: string }) =>
    ipcRenderer.invoke('codex:invoke', opts),
  codexStatus: (): Promise<{ available: boolean }> => ipcRenderer.invoke('codex:status'),
  usageSummary: (projectPath?: string): Promise<{ claudeCost: number; claudeTokens: number; claudeInputTokens: number; claudeOutputTokens: number; codexCost: number; codexTokens: number; codexEstimated: boolean; updatedAt: number }> =>
    ipcRenderer.invoke('usage:summary', { projectPath }),
  onCodexStream: (cb: (chunk: string) => void) => {
    const fn = (_: Electron.IpcRendererEvent, { chunk }: { chunk: string }) => cb(chunk)
    ipcRenderer.on('codex:stream', fn)
    return () => ipcRenderer.off('codex:stream', fn)
  },

  // External inject (from the Agy IDE extension via HTTP server)
  onExternalInject: (cb: (payload: { code: string; error?: string; file?: string; lines?: string }) => void) => {
    const fn = (_: Electron.IpcRendererEvent, payload: any) => cb(payload)
    ipcRenderer.on('external:inject', fn)
    return () => ipcRenderer.off('external:inject', fn)
  },

  // Shared browser (CDP)
  browserLaunch: (opts: { projectPath: string; url?: string }): Promise<{ success: boolean; port?: number; error?: string }> =>
    ipcRenderer.invoke('browser:launch', opts),
  browserConnect: (opts: { projectPath: string; endpoint: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('browser:connect', opts),
  browserDetect: (): Promise<{ running: boolean; endpoint: string | null }> =>
    ipcRenderer.invoke('browser:detect'),
  browserStop: (opts: { projectPath: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('browser:stop', opts),
  browserStatus: (): Promise<{ running: boolean; port: number | null }> =>
    ipcRenderer.invoke('browser:status'),
  onBrowserLaunched: (cb: (info: { port: number; url: string }) => void) => {
    const fn = (_: Electron.IpcRendererEvent, info: any) => cb(info)
    ipcRenderer.on('browser:launched', fn)
    return () => ipcRenderer.off('browser:launched', fn)
  },
  onBrowserStopped: (cb: () => void) => {
    const fn = () => cb()
    ipcRenderer.on('browser:stopped', fn)
    return () => ipcRenderer.off('browser:stopped', fn)
  },

  // HTTP server
  getServerPort: (): Promise<number> => ipcRenderer.invoke('server:getPort'),
  onServerReady: (cb: (port: number) => void) => {
    const fn = (_: Electron.IpcRendererEvent, { port }: { port: number }) => cb(port)
    ipcRenderer.on('server:ready', fn)
    return () => ipcRenderer.off('server:ready', fn)
  },
  onServerError: (cb: (msg: string) => void) => {
    const fn = (_: Electron.IpcRendererEvent, msg: string) => cb(msg)
    ipcRenderer.on('server:error', fn)
    return () => ipcRenderer.off('server:error', fn)
  },
})
