import type { Mode } from './types'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  input: string
  onInputChange: (input: string) => void
  disabled: boolean
  onSubmit: (event: React.FormEvent) => void
}

const MODE_BUTTONS: { mode: Mode; label: string; active: string }[] = [
  { mode: 'review', label: 'Review', active: 'bg-purple-900/50 text-purple-300 border border-purple-800' },
  { mode: 'research', label: 'Research', active: 'bg-blue-900/50 text-blue-300 border border-blue-800' },
  { mode: 'plan', label: 'Plan', active: 'bg-amber-900/50 text-amber-300 border border-amber-800' },
]

const PLACEHOLDER: Record<Mode, string> = {
  review: '리뷰할 코드나 변경사항… (Shift+Enter 줄바꿈)',
  plan: '만들고 싶은 기능이나 작업… (Shift+Enter 줄바꿈)',
  research: '조사할 내용… (Shift+Enter 줄바꿈)',
}

export default function CodexComposer({ mode, onModeChange, input, onInputChange, disabled, onSubmit }: Props) {
  return (
    <form onSubmit={onSubmit} className="flex-shrink-0 border-t border-surface-border p-2 flex flex-col gap-2">
      <div className="flex gap-1">
        {MODE_BUTTONS.map(button => (
          <button
            key={button.mode}
            type="button"
            onClick={() => onModeChange(button.mode)}
            className={`flex-1 py-1 text-xs rounded transition-colors ${
              mode === button.mode ? button.active : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <textarea
          value={input}
          onChange={e => {
            onInputChange(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit(e)
            }
          }}
          placeholder={PLACEHOLDER[mode]}
          rows={3}
          disabled={disabled}
          style={{ minHeight: '60px', maxHeight: '300px' }}
          className="w-full bg-surface-2 border border-surface-border rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 resize-y focus:outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="w-full py-1.5 bg-accent hover:bg-accent-dim text-white text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </div>
    </form>
  )
}
