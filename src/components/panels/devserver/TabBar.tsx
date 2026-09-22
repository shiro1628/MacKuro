import type { TabInfo } from './tabs'

interface Props {
  tabs: TabInfo[]
  activeId: string
  devServerScript: string | null
  onSelect: (id: string) => void
  onClose: (event: React.MouseEvent, id: string) => void
  onAdd: () => void
  onRunScript: () => void
  onRestart: () => void
}

export default function TabBar({
  tabs, activeId, devServerScript, onSelect, onClose, onAdd, onRunScript, onRestart,
}: Props) {
  return (
    <div
      className="flex items-stretch bg-surface-1 border-b border-surface-border flex-shrink-0 overflow-x-auto"
      style={{ height: 30, minHeight: 30 }}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-1.5 px-3 h-full text-xs whitespace-nowrap border-r border-surface-border flex-shrink-0 transition-colors ${
            tab.id === activeId
              ? 'bg-surface text-gray-300'
              : 'text-gray-600 hover:text-gray-400 hover:bg-surface-2'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
            tab.id === activeId ? 'bg-accent' : 'bg-gray-700'
          }`} />
          {tab.label}
          {tabs.length > 1 && (
            <span
              onClick={e => onClose(e, tab.id)}
              className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity leading-none text-sm"
            >×</span>
          )}
        </button>
      ))}

      <button
        onClick={onAdd}
        className="px-2.5 h-full text-gray-600 hover:text-accent hover:bg-surface-2 transition-colors text-base flex-shrink-0"
        title="새 터미널 (terminal)"
      >+</button>

      <div className="flex-1" />

      {devServerScript && (
        <button
          className="titlebar-nodrag flex items-center justify-center w-8 h-full text-gray-700 hover:text-accent transition-colors flex-shrink-0"
          title={`${devServerScript} 실행`}
          aria-label={`${devServerScript} 실행`}
          onClick={onRunScript}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.1-6.8a1 1 0 0 0 0-1.7l-10.1-6.8A1 1 0 0 0 8 5.2Z" />
          </svg>
        </button>
      )}

      <button
        className="titlebar-nodrag flex items-center justify-center w-8 h-full text-gray-700 hover:text-accent transition-colors flex-shrink-0"
        title="현재 터미널 다시 실행"
        aria-label="현재 터미널 다시 실행"
        onClick={onRestart}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 11a8 8 0 0 0-14.7-4L3 9" />
          <path d="M3 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.7 4L21 15" />
          <path d="M21 20v-5h-5" />
        </svg>
      </button>
    </div>
  )
}
