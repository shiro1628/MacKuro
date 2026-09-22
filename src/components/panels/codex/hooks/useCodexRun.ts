import { useCallback } from 'react'
import { useAppStore } from '../../../../store/useAppStore'
import type { Mode } from '../types'

type InvokeResult = { success: boolean; output: string; error: string }

/** Start a Codex run and fold its result back into the entry it created. */
export function useCodexRun() {
  const project = useAppStore(s => s.project)
  const activeId = useAppStore(s => s.activeCodexId)
  const addCodexEntry = useAppStore(s => s.addCodexEntry)
  const finishCodexEntry = useAppStore(s => s.finishCodexEntry)
  const failCodexEntry = useAppStore(s => s.failCodexEntry)
  const log = useAppStore(s => s.log)

  const settle = useCallback((id: string, result: InvokeResult, successMessage: string) => {
    if (!result.success) {
      failCodexEntry(id, result.error || 'Codex가 출력 없이 종료했습니다.')
      log('error', `Codex 오류: ${result.error}`)
    } else {
      finishCodexEntry(id)
      log('success', successMessage)
    }
  }, [failCodexEntry, finishCodexEntry, log])

  const runReview = useCallback(async (reviewInput: string) => {
    if (!project || activeId) return
    const id = addCodexEntry({ mode: 'review', input: reviewInput, output: '', loading: true })
    log('info', `Codex 자동 리뷰 요청: ${reviewInput.slice(0, 40)}…`)
    const result = await window.kuro.codexInvoke({ mode: 'review', input: reviewInput, projectPath: project.path })
    settle(id, result, 'Codex 리뷰 완료')
  }, [project, activeId, addCodexEntry, log, settle])

  const runPrompt = useCallback(async (mode: Mode, input: string) => {
    const id = addCodexEntry({ mode, input, output: '', loading: true })
    log('info', `Codex research 요청: ${input.slice(0, 40)}…`)
    const result = await window.kuro.codexInvoke({ mode, input, projectPath: project?.path })
    settle(id, result, `Codex ${mode} 완료`)
  }, [project?.path, addCodexEntry, log, settle])

  return { runReview, runPrompt }
}
