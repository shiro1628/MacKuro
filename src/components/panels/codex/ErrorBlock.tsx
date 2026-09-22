// `codex exec` writes its banner *and* its failures to stderr, so a failed run
// leaves stdout empty. Lead with the ERROR: lines and keep the raw log foldable.
export default function ErrorBlock({ error }: { error: string }) {
  const highlights = error
    .split(/\r?\n/)
    .filter(line => /^\s*(ERROR|error):/.test(line))
    .filter((line, index, all) => all.indexOf(line) === index)

  return (
    <div className="rounded border border-red-900/50 bg-red-950/20 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-1.5 text-red-400 font-semibold mb-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Codex 실행 실패
      </div>
      {highlights.length > 0 && (
        <ul className="mb-1.5 space-y-0.5 text-red-300">
          {highlights.map((line, index) => (
            <li key={index}>{line.replace(/^\s*(ERROR|error):\s*/, '')}</li>
          ))}
        </ul>
      )}
      <details className="text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300 select-none">stderr 전체 보기</summary>
        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-gray-500">{error}</pre>
      </details>
    </div>
  )
}
