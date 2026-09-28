import { useEffect, useState } from 'react'

const REFRESH_MS = 10000

export interface UsageSummary {
  claudeCost: number
  claudeEstimated: boolean
  claudeTokens: number
  claudeInputTokens: number
  claudeOutputTokens: number
  codexCost: number
  codexTokens: number
  codexEstimated: boolean
}

const EMPTY: UsageSummary = {
  claudeCost: 0, claudeEstimated: true, claudeTokens: 0,
  claudeInputTokens: 0, claudeOutputTokens: 0,
  codexCost: 0, codexTokens: 0, codexEstimated: true,
}

export interface UsageView {
  /** Machine-wide cumulative spend across every project's logs. */
  total: UsageSummary
  /** The open project's share of that total; undefined when no project is open. */
  project?: UsageSummary
}

/**
 * Cumulative spend, re-read from the CLIs' local logs on a timer. The chips
 * show the machine-wide total; the per-project figure only feeds the tooltip.
 */
export function useUsageSummary(projectPath: string | undefined): UsageView {
  const [view, setView] = useState<UsageView>({ total: EMPTY })

  useEffect(() => {
    const refresh = () => Promise.all([
      window.kuro.usageSummary(),
      projectPath ? window.kuro.usageSummary(projectPath) : Promise.resolve(undefined),
    ]).then(([total, project]) => setView({ total, project })).catch(() => undefined)
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [projectPath])

  return view
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}
