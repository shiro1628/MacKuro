import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../../../../store/useAppStore'
import type { WorktreeStatus } from '../types'

const POLL_MS = 4000

/** Poll `git status` for the open project and create new worktrees. */
export function useWorktree(projectPath: string | undefined) {
  const log = useAppStore(s => s.log)
  const [worktree, setWorktree] = useState<WorktreeStatus | null>(null)

  const refresh = useCallback(async () => {
    if (!projectPath) return
    setWorktree(await window.kuro.gitStatus(projectPath))
  }, [projectPath])

  const create = useCallback(async () => {
    if (!projectPath) return
    const branch = window.prompt('새 Worktree 브랜치 이름', 'feature/')?.trim()
    if (!branch) return
    const result = await window.kuro.gitWorktreeAdd(projectPath, branch)
    if (result.success) {
      log('success', `Worktree 생성됨 — ${result.path}`)
      await refresh()
    } else {
      log('error', `Worktree 생성 실패 — ${result.error}`)
    }
  }, [projectPath, refresh, log])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { worktree, refresh, create }
}
