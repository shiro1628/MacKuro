export {}

declare global {
  interface Window {
    kuro: {
      ptySpawn: (opts: { id: string; cwd: string; command: string; args?: string[] }) => Promise<{ success: boolean; error?: string }>
      ptyWrite: (id: string, data: string) => void
      ptyResize: (id: string, cols: number, rows: number) => Promise<void>
      ptyKill: (id: string) => Promise<void>
      agyIdeOpen: (opts: { projectPath: string }) => Promise<{ success: boolean; error?: string }>
      agyIdeRunning: () => Promise<boolean>
      onPtyData: (cb: (id: string, data: string) => void) => () => void
      onPtyExit: (cb: (id: string, code: number) => void) => () => void
      openFolder: () => Promise<string | null>
      mcpInject: (projectPath: string) => Promise<{ success: boolean; error?: string }>
      gitDiff: (projectPath: string) => Promise<{ diff: string; empty: boolean }>
      gitStatus: (projectPath: string) => Promise<{ branch: string; files: { code: string; path: string }[]; summary: string }>
      gitWorktreeAdd: (projectPath: string, branchName: string) => Promise<{ success: boolean; path?: string; error?: string }>
      devserverDetect: (projectPath: string) => Promise<{ name: string; script: string } | null>
      codexInvoke: (opts: { mode: 'review' | 'plan' | 'research'; input: string; context?: string; projectPath?: string }) => Promise<{ success: boolean; output: string; error: string }>
      codexStatus: () => Promise<{ available: boolean }>
      usageSummary: (projectPath?: string) => Promise<{ claudeCost: number; codexCost: number; codexTokens: number; codexEstimated: boolean; updatedAt: number }>
      onCodexStream: (cb: (chunk: string) => void) => () => void
      onExternalInject: (cb: (payload: { code: string; error?: string; file?: string; lines?: string }) => void) => () => void
      getServerPort: () => Promise<number>
      onServerReady: (cb: (port: number) => void) => () => void
      onServerError: (cb: (msg: string) => void) => () => void
    }
  }
}
