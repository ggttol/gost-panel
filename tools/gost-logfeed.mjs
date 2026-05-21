#!/usr/bin/env node
// gost-logfeed — tiny SSE bridge that tails the gost log file and pushes
// each line to connected browsers. No persistence; rolling tail only.
//
// Env:
//   LOG_FILE   path to tail (default /var/log/gost/gost.log)
//   PORT       listen port (default 19090)
//   HOST       bind address (default 0.0.0.0)
//   TOKEN      if set, /stream requires ?t=<token> matching

import http from 'node:http'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

const LOG_FILE = process.env.LOG_FILE || '/var/log/gost/gost.log'
const PORT = Number(process.env.PORT || 19090)
const HOST = process.env.HOST || '0.0.0.0'
const TOKEN = process.env.TOKEN || ''

const clients = new Set()

const tail = spawn('tail', ['-Fn', '0', LOG_FILE], { stdio: ['ignore', 'pipe', 'pipe'] })

tail.stderr.on('data', (b) => process.stderr.write(b))
tail.on('exit', (code) => {
  console.error(`tail exited code=${code}; gost-logfeed exiting`)
  process.exit(1)
})

let buf = ''
tail.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8')
  let idx
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx)
    buf = buf.slice(idx + 1)
    if (line.length === 0) continue
    for (const c of clients) c.send(line)
  }
})

function checkToken(reqUrl) {
  if (!TOKEN) return true
  try {
    const u = new URL(reqUrl, 'http://_')
    const t = u.searchParams.get('t') ?? ''
    // Constant-time compare to avoid trivial timing oracles.
    if (t.length !== TOKEN.length) return false
    return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN))
  } catch {
    return false
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const path = (req.url || '').split('?')[0]

  if (path === '/health') {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ ok: true, clients: clients.size, file: LOG_FILE, auth: TOKEN ? 'token' : 'open' }))
  }

  if (path === '/stream') {
    if (!checkToken(req.url || '')) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'text/plain')
      return res.end('unauthorized')
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const client = {
      send(line) {
        try { res.write(`data: ${line.replace(/\r/g, '')}\n\n`) } catch { /* broken pipe */ }
      },
    }
    clients.add(client)
    res.write(`: connected to ${LOG_FILE}\n\n`)

    const keepalive = setInterval(() => {
      try { res.write(': keepalive\n\n') } catch { /* ignore */ }
    }, 25_000)

    req.on('close', () => {
      clearInterval(keepalive)
      clients.delete(client)
    })
    return
  }

  res.statusCode = 404
  res.end('gost-logfeed — endpoints: /stream (SSE), /health\n')
})

server.listen(PORT, HOST, () => {
  console.error(`gost-logfeed listening on ${HOST}:${PORT}, tailing ${LOG_FILE}, auth=${TOKEN ? 'token' : 'open'}`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close()
    tail.kill()
    process.exit(0)
  })
}
