import { useEffect, useRef } from 'react'
import { useProjectStore } from '../../../../store/projectStore'

/**
 * Append streamed Codex chunks to the entry currently in flight. Chunks carry
 * the entry id they were started for, since other projects stream concurrently.
 *
 * Subscribe once and read the active id from a ref. Re-subscribing on every
 * activeId change loses the chunks that arrive before React flushes the new
 * subscription, which showed up as a silently empty entry.
 */
export function useCodexStream(activeId: string | null) {
  const appendCodexChunk = useProjectStore(s => s.appendCodexChunk)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  useEffect(() => {
    const off = window.kuro.onCodexStream((chunk, streamId) => {
      const id = activeIdRef.current
      if (id && id === streamId) appendCodexChunk(id, chunk)
    })
    return off
  }, [])
}
