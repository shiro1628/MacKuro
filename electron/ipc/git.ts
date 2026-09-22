import { ipcMain } from 'electron'
import { spawn as spawnChild } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// An untracked file has no blob to diff against, so each one costs a process.
// Cap it so a fresh checkout cannot spawn hundreds.
const MAX_UNTRACKED = 20

/** Run git and resolve with stdout; never rejects. */
function git(args: string[], cwd: string): Promise<{ stdout: string; code: number | null }> {
  return new Promise(resolve => {
    const child = spawnChild('git', args, { cwd, stdio: 'pipe' })
    let stdout = ''
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    child.on('close', code => resolve({ stdout, code }))
    child.on('error', () => resolve({ stdout: '', code: null }))
  })
}

/**
 * `git diff HEAD` only covers tracked files, so work that is all new files
 * looked like "no changes" to the reviewer. Diff each untracked file against
 * /dev/null as well. --no-index exits 1 when there is a difference, which is
 * the normal case here, so the exit code is ignored.
 */
async function untrackedDiff(projectPath: string): Promise<string> {
  const { stdout } = await git(['ls-files', '--others', '--exclude-standard'], projectPath)
  const files = stdout.split('\n').map(line => line.trim()).filter(Boolean)
  if (files.length === 0) return ''

  const diffs = await Promise.all(files.slice(0, MAX_UNTRACKED).map(async file => {
    const result = await git(['diff', '--no-index', '--', '/dev/null', file], projectPath)
    return result.stdout
  }))

  const omitted = files.length - MAX_UNTRACKED
  const notice = omitted > 0 ? `\n[추적되지 않은 파일 ${omitted}개 생략]\n` : ''
  return diffs.filter(Boolean).join('') + notice
}

export function registerGitIpc() {
  ipcMain.handle('git:diff', async (_, { projectPath }: { projectPath: string }) => {
    // Uncommitted work first: tracked changes plus anything untracked.
    const [tracked, untracked] = await Promise.all([
      git(['diff', 'HEAD'], projectPath),
      untrackedDiff(projectPath),
    ])
    const uncommitted = tracked.stdout + untracked
    if (uncommitted.trim()) return { diff: uncommitted, empty: false }

    // Nothing uncommitted — fall back to the last commit.
    const last = await git(['show', 'HEAD', '--format=commit %H%n%s%n', '-p'], projectPath)
    return { diff: last.stdout, empty: !last.stdout.trim() }
  })

  ipcMain.handle('git:status', async (_, { projectPath }: { projectPath: string }) => {
    return new Promise<{ branch: string; files: { code: string; path: string }[]; summary: string }>(resolve => {
      const child = spawnChild('git', ['status', '--short', '--branch'], { cwd: projectPath, stdio: 'pipe' })
      let out = ''
      child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      child.on('close', code => {
        if (code !== 0) return resolve({ branch: '', files: [], summary: 'Git worktree를 읽을 수 없습니다.' })
        const lines = out.split(/\r?\n/).filter(Boolean)
        const branchLine = lines.shift() ?? ''
        const files = lines.map(line => ({
          code: line.slice(0, 2),
          path: line.slice(3).trim(),
        }))
        const changed = files.length
        resolve({
          branch: branchLine.replace(/^##\s*/, '').trim(),
          files,
          summary: changed ? `${changed}개 파일 변경` : '변경사항 없음',
        })
      })
      child.on('error', () => resolve({ branch: '', files: [], summary: 'Git worktree를 읽을 수 없습니다.' }))
    })
  })

  ipcMain.handle('git:worktree-add', async (_, { projectPath, branchName }: { projectPath: string; branchName: string }) => {
    const branch = branchName.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..')) {
      return { success: false, error: '브랜치 이름에 사용할 수 없는 문자가 있습니다.' }
    }
    const folder = branch.split('/').pop() || branch
    const worktreePath = join(projectPath, '.worktrees', folder)
    if (existsSync(worktreePath)) return { success: false, error: `이미 존재하는 폴더입니다: ${worktreePath}` }
    mkdirSync(join(projectPath, '.worktrees'), { recursive: true })
    return new Promise<{ success: boolean; path?: string; error?: string }>(resolve => {
      const child = spawnChild('git', ['worktree', 'add', '-b', branch, worktreePath], { cwd: projectPath, stdio: 'pipe' })
      let error = ''
      child.stderr?.on('data', (d: Buffer) => { error += d.toString() })
      child.on('close', code => code === 0
        ? resolve({ success: true, path: worktreePath })
        : resolve({ success: false, error: error.trim() || `git 종료 코드: ${code}` }))
      child.on('error', err => resolve({ success: false, error: err.message }))
    })
  })
}
