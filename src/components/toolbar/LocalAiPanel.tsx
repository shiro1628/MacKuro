import { useEffect, useState, type ReactNode } from 'react'
import { formatBytes, type useLocalAi } from './hooks/useLocalAi'

type Props = ReturnType<typeof useLocalAi>

const KEEP_ALIVE_OPTIONS: { label: string; value: string | number }[] = [
  { label: '5분', value: '5m' },
  { label: '30분', value: '30m' },
  { label: '1시간', value: '1h' },
  { label: '해제할 때까지', value: -1 },
]

const panelClass = 'absolute right-0 top-full mt-2 z-50 w-[460px] max-h-[80vh] overflow-y-auto rounded-xl border border-surface-border bg-surface-1 p-3 shadow-2xl'

const btn = 'px-2 py-0.5 text-[11px] rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap'
const btnNeutral = `${btn} border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500`
const btnAccent = `${btn} border-accent/40 text-accent hover:bg-accent/10`
const btnDanger = `${btn} border-red-400/30 text-red-300/80 hover:text-red-300 hover:border-red-400/60`

function Meter({ label, value, max, detail }: { label: string; value: number | null; max: number; detail: string }) {
  const pct = value == null || max <= 0 ? 0 : Math.min(100, (value / max) * 100)
  const color = pct > 85 ? '#f87171' : pct > 65 ? '#f0a500' : '#8b9a6b'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-mono text-gray-400">{detail}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Section({ title, running, meta, actions, children }: {
  title: string; running: boolean; meta?: string; actions: ReactNode; children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-surface-border bg-surface-2/60 p-3">
      <header className="flex items-center gap-2 mb-2.5">
        <span className={`status-dot ${running ? 'running' : 'idle'}`} />
        <span className="text-xs font-semibold text-gray-200">{title}</span>
        <span className="text-[10px] text-gray-600 truncate">{meta}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">{actions}</div>
      </header>
      {children}
    </section>
  )
}

function expiresIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  // Ollama reports a far-future timestamp for keep_alive < 0.
  if (!Number.isFinite(ms) || ms > 365 * 24 * 3600_000) return '상시'
  if (ms <= 0) return '곧 해제'
  const min = Math.round(ms / 60_000)
  return min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`
}

export default function LocalAiPanel({ status, busy, pulls, run }: Props) {
  const [keepAlive, setKeepAlive] = useState<string | number>('30m')
  const [pullName, setPullName] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    if (!showLogs) return
    const load = () => window.kuro.comfyLogs().then(setLogs)
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [showLogs])

  if (!status) {
    return <div className={`${panelClass} text-xs text-gray-500`}>상태 확인 중…</div>
  }

  const { machine, ollama, comfy } = status
  const loadedNames = new Set(ollama.loaded.map(m => m.name))
  const vramUsed = comfy.vramTotal != null && comfy.vramFree != null ? comfy.vramTotal - comfy.vramFree : null

  const startPull = () => {
    const model = pullName.trim()
    if (!model) return
    setPullName('')
    run(`pull:${model}`, `${model} 다운로드 완료`, () => window.kuro.ollamaPull(model))
  }

  return (
    <div className={`${panelClass} space-y-3`}>
      {/* Machine */}
      <div className="flex gap-4 px-1">
        <Meter
          label="메모리"
          value={machine.memUsed}
          max={machine.memTotal}
          detail={`${formatBytes(machine.memUsed)} / ${formatBytes(machine.memTotal)}`}
        />
        <Meter
          label="GPU"
          value={machine.gpuUtilization}
          max={100}
          detail={`${machine.gpuUtilization ?? '—'}% · ${formatBytes(machine.gpuMemUsed)}`}
        />
      </div>

      {/* Ollama */}
      <Section
        title="Ollama"
        running={ollama.running}
        meta={ollama.running ? `v${ollama.version} · :11434` : ollama.manager === 'none' ? '미설치' : '중지됨'}
        actions={ollama.running ? (
          <button className={btnDanger} disabled={busy['ollama:power']}
            onClick={() => run('ollama:power', 'Ollama 종료', window.kuro.ollamaStop)}>
            {busy['ollama:power'] ? '종료 중…' : '종료'}
          </button>
        ) : (
          <button className={btnAccent} disabled={busy['ollama:power'] || ollama.manager === 'none'}
            onClick={() => run('ollama:power', 'Ollama 시작', window.kuro.ollamaStart)}>
            {busy['ollama:power'] ? '시작 중…' : '시작'}
          </button>
        )}
      >
        {ollama.running && (
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">메모리에 로드됨</div>
              {ollama.loaded.length === 0 ? (
                <div className="text-[11px] text-gray-600">로드된 모델 없음</div>
              ) : ollama.loaded.map(m => (
                <div key={m.name} className="flex items-center gap-2 py-1 text-[11px]">
                  <span className="status-dot running" style={{ width: 5, height: 5 }} />
                  <span className="font-mono text-gray-200 truncate">{m.name}</span>
                  <span className="text-gray-500 font-mono">{formatBytes(m.size)}</span>
                  <span className="text-gray-600">
                    GPU {m.size > 0 ? Math.round((m.sizeVram / m.size) * 100) : 0}% · {expiresIn(m.expiresAt)}
                  </span>
                  <div className="flex-1" />
                  <button className={btnNeutral} disabled={busy[`unload:${m.name}`]}
                    onClick={() => run(`unload:${m.name}`, `${m.name} 메모리 해제`, () => window.kuro.ollamaUnload(m.name))}>
                    {busy[`unload:${m.name}`] ? '해제 중…' : '메모리 해제'}
                  </button>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center text-[10px] uppercase tracking-wider text-gray-600 mb-1">
                <span>설치된 모델</span>
                <div className="flex-1" />
                <span className="normal-case tracking-normal mr-1">유지</span>
                <select
                  value={String(keepAlive)}
                  onChange={e => setKeepAlive(KEEP_ALIVE_OPTIONS.find(o => String(o.value) === e.target.value)!.value)}
                  className="bg-surface-3 border border-surface-border rounded text-[10px] text-gray-300 px-1 py-0.5 normal-case tracking-normal"
                >
                  {KEEP_ALIVE_OPTIONS.map(o => <option key={o.label} value={String(o.value)}>{o.label}</option>)}
                </select>
              </div>
              {ollama.models.length === 0 && <div className="text-[11px] text-gray-600">설치된 모델 없음</div>}
              {ollama.models.map(m => {
                const isLoaded = loadedNames.has(m.name)
                return (
                  <div key={m.name} className="flex items-center gap-2 py-1 text-[11px]">
                    <span className="font-mono text-gray-300 truncate">{m.name}</span>
                    <span className="text-gray-500 font-mono">{formatBytes(m.size)}</span>
                    <span className="text-gray-600 truncate">{[m.parameterSize, m.quantization].filter(Boolean).join(' · ')}</span>
                    <div className="flex-1" />
                    <button className={btnAccent} disabled={isLoaded || busy[`load:${m.name}`]}
                      title={m.size > machine.memTotal * 0.75 ? '모델 크기가 시스템 메모리의 75%를 넘습니다' : undefined}
                      onClick={() => run(`load:${m.name}`, `${m.name} 로드`, () => window.kuro.ollamaLoad(m.name, keepAlive))}>
                      {busy[`load:${m.name}`] ? '로드 중…' : isLoaded ? '실행 중' : '실행'}
                    </button>
                    <button className={btnDanger} disabled={busy[`delete:${m.name}`]}
                      onClick={() => {
                        if (!window.confirm(`${m.name} (${formatBytes(m.size)})을(를) 삭제할까요?`)) return
                        run(`delete:${m.name}`, `${m.name} 삭제`, () => window.kuro.ollamaDelete(m.name))
                      }}>
                      삭제
                    </button>
                  </div>
                )
              })}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">모델 다운로드</div>
              <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); startPull() }}>
                <input
                  value={pullName}
                  onChange={e => setPullName(e.target.value)}
                  placeholder="예: llama3.2:3b, qwen2.5-coder:7b"
                  className="flex-1 min-w-0 bg-surface-3 border border-surface-border rounded px-2 py-1 text-[11px] font-mono text-gray-200 placeholder:text-gray-600 outline-none focus:border-accent/50"
                />
                <button type="submit" className={btnAccent} disabled={!pullName.trim()}>다운로드</button>
              </form>
              {Object.entries(pulls).map(([model, p]) => {
                const pct = p.total ? Math.round(((p.completed ?? 0) / p.total) * 100) : null
                return (
                  <div key={model} className="mt-2 text-[11px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-gray-300 truncate">{model}</span>
                      <span className="text-gray-600 truncate">{p.status}</span>
                      <div className="flex-1" />
                      <span className="font-mono text-gray-400">
                        {pct != null ? `${pct}% · ${formatBytes(p.completed)} / ${formatBytes(p.total)}` : ''}
                      </span>
                      <button className={btnNeutral} onClick={() => window.kuro.ollamaCancelPull(model)}>취소</button>
                    </div>
                    <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                      <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ComfyUI */}
      <Section
        title="ComfyUI"
        running={comfy.running}
        meta={comfy.running
          ? `${comfy.version ? `v${comfy.version} · ` : ''}${comfy.device ?? ''} · :8188${comfy.managed ? '' : ' · 외부 실행'}`
          : comfy.installed ? '중지됨' : '설치 없음'}
        actions={<>
          {comfy.running && (
            <button className={btnNeutral} onClick={() => window.kuro.comfyOpenUi()}>UI 열기</button>
          )}
          {comfy.running ? (
            <button className={btnDanger} disabled={busy['comfy:power']}
              onClick={() => run('comfy:power', 'ComfyUI 종료', window.kuro.comfyStop)}>
              {busy['comfy:power'] ? '종료 중…' : '종료'}
            </button>
          ) : (
            <button className={btnAccent} disabled={busy['comfy:power'] || !comfy.installed}
              title="Comfy Desktop 설치본을 헤드리스로 실행합니다"
              onClick={() => { setShowLogs(true); run('comfy:power', 'ComfyUI 시작', window.kuro.comfyStart) }}>
              {busy['comfy:power'] ? '시작 중…' : '시작'}
            </button>
          )}
        </>}
      >
        {comfy.running && (
          <div className="space-y-2.5">
            <div className="flex gap-4">
              {/* On MPS "VRAM" is just system memory, already shown up top. */}
              {comfy.device !== 'mps' && <Meter
                label="VRAM"
                value={vramUsed}
                max={comfy.vramTotal ?? 0}
                detail={`${formatBytes(vramUsed)} / ${formatBytes(comfy.vramTotal)}`}
              />}
              <div className="text-[10px] text-gray-500 whitespace-nowrap self-end">
                큐 <span className="font-mono text-gray-300">{comfy.queueRunning ?? 0}</span> 실행
                · <span className="font-mono text-gray-300">{comfy.queuePending ?? 0}</span> 대기
              </div>
            </div>
            <div className="flex gap-1.5">
              <button className={btnNeutral} disabled={busy['comfy:free']}
                onClick={() => run('comfy:free', 'ComfyUI 모델 메모리 해제', window.kuro.comfyFree)}>
                {busy['comfy:free'] ? '해제 중…' : '모델 메모리 해제'}
              </button>
            </div>
          </div>
        )}
        {!comfy.running && comfy.installPath && (
          <div className="text-[10px] text-gray-600 font-mono truncate" title={comfy.installPath}>{comfy.installPath}</div>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          {comfy.desktopApp && (
            <button className={btnNeutral} onClick={() => run('comfy:desktop', 'Comfy Desktop 실행', window.kuro.comfyOpenDesktop)}>
              Comfy Desktop 앱
            </button>
          )}
          <button className={btnNeutral} onClick={() => setShowLogs(v => !v)}>
            {showLogs ? '로그 숨기기' : '로그'}
          </button>
        </div>
        {showLogs && (
          <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-black/40 p-2 text-[10px] leading-snug text-gray-500 font-mono whitespace-pre-wrap">
            {logs.length ? logs.slice(-80).join('\n') : comfy.managed ? '로그 없음' : 'MacKuro에서 시작한 ComfyUI의 로그만 표시됩니다.'}
          </pre>
        )}
      </Section>
    </div>
  )
}
