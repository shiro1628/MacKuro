export interface TabInfo {
  id: string
  label: string
  ptyId: string
  /** npm script to run on spawn; null opens a plain interactive shell. */
  command: string | null
}

let counter = 0

export function newTab(label: string, command: string | null = null): TabInfo {
  const n = ++counter
  return { id: `t${n}`, label, ptyId: `devserver-${n}`, command }
}

export function resetTabCounter() {
  counter = 0
}

/**
 * Keep the interactive shell alive after an npm script finishes. Without
 * this, a normal command failure closes the PTY and only shows [exited: 1].
 */
export function spawnArgsFor(command: string | null): string[] {
  if (!command) return ['-l', '-i']
  const keepAlive = `${command}; status=$?; printf '\\n\\033[90m[command exited: %s]\\033[0m\\n' "$status"; exec /bin/zsh -l -i`
  return ['-l', '-i', '-c', keepAlive]
}
