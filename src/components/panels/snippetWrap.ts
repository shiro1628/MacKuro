// Bracketed-paste markers. Claude enables this mode, so xterm wraps every paste in them.
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

/**
 * Heuristic for "this looks pasted from an editor" rather than typed. Plain
 * indentation is deliberately not a signal on its own — indented prose and
 * pasted logs matched it, and got wrapped in <snippet> against the user's
 * intent. Require actual code punctuation or a keyword.
 */
function looksLikeCode(text: string): boolean {
  const lines = text.split('\n')
  if (lines.length < 3) return false
  return /[{};()=>]/.test(text)                                                  // 코드 문법 문자
    || /^\s*(const|let|var|def|fn|func|import|export|class|if|for|return)\b/m.test(text) // 키워드
}

/**
 * If terminal input is a paste of code, return it wrapped in <snippet> tags
 * (still as one bracketed paste, so the newlines never submit). Otherwise null.
 */
export function wrapPastedCode(data: string): { data: string; lines: number } | null {
  if (!data.startsWith(PASTE_START) || !data.endsWith(PASTE_END)) return null
  // xterm turns pasted newlines into \r; normalize before counting lines.
  const text = data.slice(PASTE_START.length, -PASTE_END.length).replace(/\r\n?/g, '\n').trimEnd()
  if (!looksLikeCode(text)) return null
  return {
    data: `${PASTE_START}<snippet>\n${text}\n</snippet>\n${PASTE_END}`,
    lines: text.split('\n').length,
  }
}
