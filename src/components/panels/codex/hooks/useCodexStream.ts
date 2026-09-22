import { useEffect, useRef } from 'react'
import { useAppStore } from '../../../../store/useAppStore'

/**
 * Append streamed Codex chunks to the entry currently in flight.
 *
 * Subscribe once and read the active id from a ref. Re-subscribing on every
 * activeId change loses the chunks that arrive before React flushes the new
 * subscription, which showed up as a silently empty entry.
 */
export function useCodexStream(activeId: string | null) {
  const appendCodexChunk = useAppStore(s => s.appendCodexChunk)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  useEffect(() => {
    const off = window.kuro.onCodexStream(chunk => {
      const id = activeIdRef.current
      if (id) appendCodexChunk(id, chunk)
    })
    return off
  }, [])
}
