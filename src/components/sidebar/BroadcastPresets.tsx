import { useState } from 'react'
import { summarize, useBroadcastLibrary } from '../../store/broadcastLibrary'
import { btnAccent, btnDanger, btnNeutral, field } from './broadcastStyles'

/** A preset being edited; `id` is null while creating a new one. */
interface Draft { id: string | null; name: string; prompt: string }

const chip = 'group flex items-center max-w-[160px] rounded-full border text-[11px] transition-colors'

/** Saved prompts: click to load into the editor, ✎ to rename or rewrite, + to save the current prompt. */
export default function BroadcastPresets({ prompt, onPick }: { prompt: string; onPick: (text: string) => void }) {
  const presets = useBroadcastLibrary(s => s.presets)
  const addPreset = useBroadcastLibrary(s => s.addPreset)
  const updatePreset = useBroadcastLibrary(s => s.updatePreset)
  const removePreset = useBroadcastLibrary(s => s.removePreset)
  const [draft, setDraft] = useState<Draft | null>(null)

  const canSave = !!draft && draft.prompt.trim().length > 0

  const save = () => {
    if (!draft || !canSave) return
    const name = draft.name.trim() || summarize(draft.prompt)
    if (draft.id) updatePreset(draft.id, { name, prompt: draft.prompt.trim() })
    else addPreset(name, draft.prompt)
    setDraft(null)
  }

  return (
    <section className="mb-2">
      <div className="flex flex-wrap items-center gap-1">
        {presets.map(p => {
          const editing = draft?.id === p.id
          return (
            <span
              key={p.id}
              className={`${chip} ${editing
                ? 'border-accent/50 text-accent bg-accent/10'
                : 'border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}
            >
              <button className="truncate pl-2 py-0.5 active:scale-95" title={p.prompt} onClick={() => onPick(p.prompt)}>
                {p.name}
              </button>
              <button
                className="px-1.5 py-0.5 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-accent"
                title="프리셋 수정"
                onClick={() => setDraft(editing ? null : { id: p.id, name: p.name, prompt: p.prompt })}
              >
                ✎
              </button>
            </span>
          )
        })}
        <button
          className={`${chip} px-2 py-0.5 border-dashed border-surface-border text-gray-600 hover:text-accent hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed`}
          disabled={!prompt.trim()}
          title={prompt.trim() ? '지금 입력한 프롬프트를 프리셋으로 저장' : '프롬프트를 입력하면 저장할 수 있습니다'}
          onClick={() => setDraft({ id: null, name: summarize(prompt), prompt })}
        >
          + 프리셋 저장
        </button>
      </div>

      {draft && (
        <div
          className="mt-2 rounded-md border border-accent/30 bg-surface-2/50 p-2 flex flex-col gap-1.5"
          onKeyDown={e => {
            // Escape cancels the edit instead of closing the whole panel.
            if (e.key === 'Escape') { e.stopPropagation(); setDraft(null) }
            if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); e.stopPropagation(); save() }
          }}
        >
          <input
            autoFocus
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder="프리셋 이름"
            className={field}
          />
          <textarea
            value={draft.prompt}
            onChange={e => setDraft({ ...draft, prompt: e.target.value })}
            rows={3}
            placeholder="프롬프트"
            className={`${field} resize-y`}
          />
          <div className="flex items-center gap-1.5">
            {draft.id && (
              <button className={btnDanger} onClick={() => { removePreset(draft.id!); setDraft(null) }}>
                삭제
              </button>
            )}
            <span className="flex-1" />
            <button className={btnNeutral} onClick={() => setDraft(null)}>취소</button>
            <button className={btnAccent} disabled={!canSave} onClick={save} title="⌘Enter">
              {draft.id ? '수정 저장' : '저장'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
