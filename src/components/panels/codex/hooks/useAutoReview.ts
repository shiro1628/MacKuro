import { useEffect, useRef } from 'react'

const POLL_MS = 8000

const autoReviewPrompt = (diff: string) =>
  `현재 작업 중인 git worktree의 변경사항을 리뷰해줘. 아직 커밋하지 않은 변경이며, 버그·보안·회귀 위험을 우선 확인해줘.\n\n${diff}`

// Cheap stand-in for hashing the whole diff.
const fingerprintOf = (diff: string) =>
  `${diff.length}:${diff.slice(0, 160)}:${diff.slice(-160)}`

interface Options {
  projectPath: string | undefined
  enabled: boolean
  activeId: string | null
  runReview: (input: string) => Promise<void>
}

/**
 * Wait for the worktree diff to remain unchanged for two polls before
 * reviewing it. This keeps Codex from interrupting an active edit burst.
 */
export function useAutoReview({ projectPath, enabled, activeId, runReview }: Options) {
  const lastDiffRef = useRef('')
  const reviewedDiffRef = useRef('')
  const runReviewRef = useRef(runReview)
  runReviewRef.current = runReview

  // A different project means the previous fingerprints say nothing.
  useEffect(() => {
    lastDiffRef.current = ''
    reviewedDiffRef.current = ''
  }, [projectPath])

  useEffect(() => {
    if (!projectPath || !enabled) return
    const timer = setInterval(async () => {
      if (activeId) return
      const { diff, empty } = await window.kuro.gitDiff(projectPath)
      if (empty) {
        lastDiffRef.current = ''
        reviewedDiffRef.current = ''
        return
      }
      const fingerprint = fingerprintOf(diff)
      if (fingerprint === lastDiffRef.current && fingerprint !== reviewedDiffRef.current) {
        reviewedDiffRef.current = fingerprint
        await runReviewRef.current(autoReviewPrompt(diff))
      } else {
        lastDiffRef.current = fingerprint
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [projectPath, enabled, activeId])
}
