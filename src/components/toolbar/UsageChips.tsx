import { formatTokens, type UsageSummary } from './hooks/useUsageSummary'

interface Props {
  usage: UsageSummary
  codexAvailable: boolean
}

export default function UsageChips({ usage, codexAvailable }: Props) {
  const title = [
    '로컬 로그 기준 누적 비용',
    `Claude: $${usage.claudeCost.toFixed(2)}${usage.claudeEstimated ? ' (추정)' : ''} · ${formatTokens(usage.claudeTokens)} tokens`,
    `Codex: $${usage.codexCost.toFixed(2)}${usage.codexEstimated ? ' (추정)' : ''} · ${formatTokens(usage.codexTokens)} tokens`,
  ].join('\n')

  return (
    <div className="titlebar-nodrag ai-usage flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-1"
      title={title}>
      <span className="ai-usage-chip active"><i />Claude ${usage.claudeCost.toFixed(2)}</span>
      <span className={`ai-usage-chip ${codexAvailable ? 'available codex' : ''}`}><i />Codex ${usage.codexCost.toFixed(2)}</span>
    </div>
  )
}
