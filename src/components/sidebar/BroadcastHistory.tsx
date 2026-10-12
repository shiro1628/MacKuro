import { useState } from 'react'
import { summarize, useBroadcastLibrary, type HistoryEntry, type HistoryOutcome } from '../../store/broadcastLibrary'
import { btnDanger, btnNeutral } from './broadcastStyles'

const OUTCOME_LABEL: Record<HistoryOutcome, string> = {
  pending: '진행 중',
  sent: '전송됨',
  queued: '전송됨(작업 후 처리)',
  failed: '실패',
}

function formatTime(at: number) {
  const d = new Date(at)
  const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function OutcomeSummary({ entry }: { entry: HistoryEntry }) {
  const count = (o: HistoryOutcome) => entry.targets.filter(t => t.outcome === o).length
  const ok = count('sent') + count('queued')
  const failed = count('failed')
  const pending = count('pending')
  const detail = entry.targets
    .map(t => `${t.name}: ${OUTCOME_LABEL[t.outcome]}${t.reason ? ` — ${t.reason}` : ''}`)
    .join('\n')

  return (
    <span className="flex items-center gap-1.5 text-[10px] flex-shrink-0" title={detail}>
      {ok > 0 && <span className="text-green-400">✓{ok}</span>}
      {failed > 0 && <span className="text-red-300">✕{failed}</span>}
      {pending > 0 && <span className="text-gray-400 animate-pulse">…{pending}</span>}
    </span>
  )
}

/** Recent broadcasts, newest first: what was sent, where, and how it went. */
export default function BroadcastHistory({ onLoad }: { onLoad: (text: string) => void }) {
  const history = useBroadcastLibrary(s => s.history)
  const addPreset = useBroadcastLibrary(s => s.addPreset)
  const removeHistory = useBroadcastLibrary(s => s.removeHistory)
  const clearHistory = useBroadcastLibrary(s => s.clearHistory)
  const [open, setOpen] = useState(false)

  if (history.length === 0) return null

  return (
    <section className="mt-2 pt-2 border-t border-surface-border">
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300"
          onClick={() => setOpen(!open)}
        >
          <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
          전송 기록 <span className="text-gray-700">{history.length}</span>
        </button>
        <span className="flex-1" />
        {open && <button className={btnDanger} onClick={clearHistory}>모두 지우기</button>}
      </div>

      {open && (
        <ul className="mt-1 flex flex-col">
          {history.map(entry => (
            <li key={entry.id} className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2">
              <span className="text-[10px] text-gray-600 font-mono pt-px flex-shrink-0">{formatTime(entry.at)}</span>
              <button
                className="flex-1 min-w-0 text-left"
                title={`${entry.prompt}\n\n클릭해서 입력창에 불러오기`}
                onClick={() => onLoad(entry.prompt)}
              >
                <div className="text-xs text-gray-300 line-clamp-2 break-all">{entry.prompt}</div>
                <div className="text-[10px] text-gray-600 truncate">{entry.targets.map(t => t.name).join(', ')}</div>
              </button>
              <OutcomeSummary entry={entry} />
              <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                <button
                  className={btnNeutral}
                  title="이 프롬프트를 프리셋으로 저장 (이름은 칩의 ✎로 수정)"
                  onClick={() => addPreset(summarize(entry.prompt), entry.prompt)}
                >
                  프리셋
                </button>
                <button className={btnDanger} title="기록 삭제" onClick={() => removeHistory(entry.id)}>×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
