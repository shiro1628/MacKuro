import { chmod, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

const helper = join(
  process.cwd(),
  'node_modules',
  'node-pty',
  'prebuilds',
  `darwin-${process.arch}`,
  'spawn-helper',
)

try {
  await access(helper, constants.F_OK)
  await chmod(helper, 0o755)
  console.log(`[node-pty] ensured executable: ${helper}`)
} catch {
  // node-pty may not be installed yet, or this may be a non-macOS install.
}
