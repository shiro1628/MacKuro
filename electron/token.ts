import { randomBytes, timingSafeEqual } from 'crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// /inject 인증 토큰 — 파일 시스템 접근이 가능한 로컬 IDE 확장만
// 읽을 수 있고, 브라우저의 웹페이지는 읽을 수 없다 (drive-by 주입 차단)
const KURO_TOKEN = randomBytes(32).toString('hex')

const tokenPath = () => join(homedir(), '.kuro', 'token')

export function writeTokenFile() {
  const dir = join(homedir(), '.kuro')
  mkdirSync(dir, { recursive: true })
  writeFileSync(tokenPath(), KURO_TOKEN, { encoding: 'utf-8', mode: 0o600 })
}

export function removeTokenFile() {
  try { unlinkSync(tokenPath()) } catch {}
}

export function isValidToken(header: string | string[] | undefined): boolean {
  if (typeof header !== 'string') return false
  const a = Buffer.from(header)
  const b = Buffer.from(KURO_TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}
