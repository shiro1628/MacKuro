import { app, ipcMain } from 'electron'
import { createServer, type Server } from 'http'
import { KURO_PORT } from './constants'
import { isValidToken } from './token'
import { send } from './window'

let httpServer: Server | null = null

/** Local HTTP server: Agy IDE extension → MacKuro. */
export function startHttpServer() {
  httpServer = createServer((req, res) => {
    // CORS 헤더 없음 — 브라우저 교차 출처 접근은 의도적으로 차단.
    // IDE 확장은 Node http로 직접 호출하므로 CORS 불필요.

    if (req.method === 'POST' && req.url === '/inject') {
      if (!isValidToken(req.headers['x-kuro-token'])) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'invalid token' }))
        return
      }
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as {
            code: string
            error?: string
            file?: string
            lines?: string
          }
          send('external:inject', payload)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.writeHead(400)
          res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }))
        }
      })
      return
    }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, version: app.getVersion() }))
      return
    }

    res.writeHead(404)
    res.end()
  })

  httpServer.listen(KURO_PORT, '127.0.0.1', () => {
    send('server:ready', { port: KURO_PORT })
  })

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      send('server:error', `포트 ${KURO_PORT} 이미 사용 중`)
    }
  })
}

export function stopHttpServer() {
  httpServer?.close()
}

export function registerServerIpc() {
  ipcMain.handle('server:getPort', () => KURO_PORT)
}
