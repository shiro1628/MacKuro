import { formatTokens, type UsageSummary, type UsageView } from './hooks/useUsageSummary'

interface Props {
  usage: UsageView
  codexAvailable: boolean
}

const describe = (label: string, usage: UsageSummary) => [
  `${label} Claude: $${usage.claudeCost.toFixed(2)}${usage.claudeEstimated ? ' (추정)' : ''} · ${formatTokens(usage.claudeTokens)} tokens`,
  `${label} Codex: $${usage.codexCost.toFixed(2)}${usage.codexEstimated ? ' (추정)' : ''} · ${formatTokens(usage.codexTokens)} tokens`,
]

export default function UsageChips({ usage, codexAvailable }: Props) {
  const { total, project } = usage
  const title = [
    '로컬 로그 기준 누적 비용 (모든 프로젝트 합계)',
    ...describe('전체', total),
    ...(project ? ['', ...describe('현재 프로젝트', project)] : []),
  ].join('\n')

  return (
    <div className="titlebar-nodrag ai-usage flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-1"
      title={title}>
      <span className="ai-usage-chip active"><i />Claude ${total.claudeCost.toFixed(2)}</span>
      <span className={`ai-usage-chip ${codexAvailable ? 'available codex' : ''}`}><i />Codex ${total.codexCost.toFixed(2)}</span>
    </div>
  )
}
