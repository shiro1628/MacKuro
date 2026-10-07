import { spawn as spawnChild } from 'child_process'

/** Run a command to completion; rejects with stderr on a non-zero exit. */
export function run(command: string, args: string[], timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, { stdio: 'pipe', timeout: timeoutMs })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `${command} exited with ${code}`))
    })
  })
}
