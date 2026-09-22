export type Mode = 'review' | 'plan' | 'research'

export interface WorktreeStatus {
  branch: string
  files: { code: string; path: string }[]
  summary: string
}

export const modeLabel = (mode: Mode) =>
  mode === 'review' ? '코드 리뷰' : mode === 'plan' ? '기획' : '리서치'

export const modeColor = (mode: Mode) => mode === 'review'
  ? 'bg-purple-900/40 text-purple-300'
  : mode === 'plan' ? 'bg-amber-900/40 text-amber-300' : 'bg-blue-900/40 text-blue-300'

export const modeTag = (mode: Mode) => mode === 'plan' ? 'PLAN' : mode.toUpperCase()
