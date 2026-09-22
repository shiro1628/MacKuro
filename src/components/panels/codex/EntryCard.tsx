import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { CodexEntry } from '../../../store/useAppStore'
import ErrorBlock from './ErrorBlock'
import ExpandModal from './ExpandModal'
import VerdictBadge from './VerdictBadge'
import { mdComponents } from './markdown'
import { modeColor, modeTag } from './types'

export default function EntryCard({ entry }: { entry: CodexEntry }) {
  const [expanded, setExpanded] = useState(true)
  const [modal, setModal] = useState(false)

  return (
    <>
      {modal && <ExpandModal entry={entry} onClose={() => setModal(false)} />}
      <div className="border border-surface-border rounded mb-2 mx-2 overflow-hidden">
        <div className="w-full flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-3 transition-colors">
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${modeColor(entry.mode)}`}>{modeTag(entry.mode)}</span>
            <span className="text-xs text-gray-400 flex-1 truncate min-w-0">{entry.input.slice(0, 60)}{entry.input.length > 60 ? '…' : ''}</span>
          </button>
          {entry.loading
            ? <span className="status-dot loading flex-shrink-0" />
            : entry.error
              ? <span className="text-xs text-red-400 flex-shrink-0">● 실패</span>
              : <VerdictBadge output={entry.output} />
          }
          <span className="text-gray-600 text-xs flex-shrink-0">
            {entry.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!entry.loading && (entry.output || entry.error) && (
            <button
              onClick={() => setModal(true)}
              className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
              title="전체 화면으로 보기"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} className="text-gray-600 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</button>
        </div>

        {expanded && (
          <div className="px-3 py-2 bg-surface text-xs text-gray-300 max-h-72 overflow-y-auto leading-relaxed">
            {entry.loading && !entry.output
              ? <span className="text-gray-600 animate-pulse">Codex 응답 대기중…</span>
              : entry.error
                ? <>
                    <ErrorBlock error={entry.error} />
                    {entry.output && <div className="mt-2"><ReactMarkdown components={mdComponents}>{entry.output}</ReactMarkdown></div>}
                  </>
                : entry.output
                  ? <ReactMarkdown components={mdComponents}>{entry.output}</ReactMarkdown>
                  : <span className="text-gray-600">출력 없음</span>
            }
          </div>
        )}
      </div>
    </>
  )
}
