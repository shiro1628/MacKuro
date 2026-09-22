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

/** Cumulative spend, re-read from the CLIs' local logs on a timer. */
export function useUsageSummary(projectPath: string | undefined) {
  const [usage, setUsage] = useState<UsageSummary>(EMPTY)

  useEffect(() => {
    const refresh = () => window.kuro.usageSummary(projectPath).then(setUsage).catch(() => undefined)
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [projectPath])

  return usage
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}
