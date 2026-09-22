import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { CodexEntry } from '../../../store/useAppStore'
import ErrorBlock from './ErrorBlock'
import VerdictBadge from './VerdictBadge'
import { mdComponents } from './markdown'
import { modeColor, modeLabel, modeTag } from './types'

export default function ExpandModal({ entry, onClose }: { entry: CodexEntry; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCopy = () => {
    navigator.clipboard.writeText(entry.output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSendToClaude = () => {
    const msg = `다음 ${modeLabel(entry.mode)} 결과를 참고해서 작업해줘:\n\n${entry.output}`
    window.kuro.ptyWrite('claude', `\x1b[200~${msg}\x1b[201~`)
    setSent(true)
    setTimeout(() => { setSent(false); onClose() }, 800)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-1 border border-surface-border rounded-lg flex flex-col"
        style={{ width: '80vw', maxWidth: 900, height: '80vh' }}>
        {/* Modal header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-border flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${modeColor(entry.mode)}`}>{modeTag(entry.mode)}</span>
          <span className="text-xs text-gray-400 flex-1 truncate">{entry.input.slice(0, 80)}{entry.input.length > 80 ? '…' : ''}</span>
          <VerdictBadge output={entry.output} />
          <button
            onClick={onClose}
            className="ml-2 text-gray-600 hover:text-gray-300 text-lg leading-none transition-colors"
            title="닫기 (Esc)"
          >✕</button>
        </div>
        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-gray-300 leading-relaxed">
          {entry.error && <div className="mb-3"><ErrorBlock error={entry.error} /></div>}
          <ReactMarkdown components={mdComponents}>{entry.output}</ReactMarkdown>
        </div>
        {/* Modal footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-surface-border flex-shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            {copied ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 복사됨</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 복사</>
            )}
          </button>
          <button
            onClick={handleSendToClaude}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            {sent ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 전송됨</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Claude로 전송</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
