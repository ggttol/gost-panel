import path from 'node:path'
import fs from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const TOOLS_DIR = path.resolve(__dirname, 'tools')
const INSTALL_SH = path.join(TOOLS_DIR, 'install.sh')
const LOGFEED_MJS = path.join(TOOLS_DIR, 'gost-logfeed.mjs')
const DL_DIR = path.join(TOOLS_DIR, 'dl')

function readTemplate(panelUrl: string): string {
  const tpl = fs.readFileSync(INSTALL_SH, 'utf8')
  const mjs = fs.readFileSync(LOGFEED_MJS, 'utf8')
  return tpl
    .replace('__PANEL_URL__', panelUrl)
    .replace('__GOST_LOGFEED_MJS__', mjs)
}

/**
 * Serve & emit the bootstrap assets:
 *  - /install.sh — install script with PANEL_URL templated (dev only) and the
 *    gost-logfeed.mjs body inlined as a heredoc. Lets the gost host bootstrap
 *    in one curl, with the panel itself acting as the binary mirror.
 *  - /gost-logfeed.mjs — sidecar source, in case someone wants it standalone.
 *  - /dl/* — gost release tarballs, pre-downloaded via `pnpm fetch-binaries`,
 *    so hosts without GitHub access still work.
 *
 * Prod build emits install.sh with the __PANEL_URL__ placeholder *literal* (we
 * can't know the deployed URL at build time). The panel's Welcome page renders
 * the curl command with `window.location.origin` injected as PANEL_URL env, so
 * the user-pasted line still ends up correct.
 */
function gostPanelBootstrap(): Plugin {
  return {
    name: 'gost-panel-bootstrap',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        if (url === '/install.sh') {
          const host = req.headers.host || 'localhost'
          const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
          const panelUrl = `${proto}://${host}`
          res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8')
          res.end(readTemplate(panelUrl))
          return
        }
        if (url === '/gost-logfeed.mjs') {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(fs.readFileSync(LOGFEED_MJS))
          return
        }
        if (url.startsWith('/dl/')) {
          const requested = url.replace(/^\/dl\//, '')
          if (requested.includes('..') || requested.includes('/')) {
            res.statusCode = 400
            return res.end('bad request')
          }
          const filePath = path.join(DL_DIR, requested)
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Content-Length', String(fs.statSync(filePath).size))
            fs.createReadStream(filePath).pipe(res)
            return
          }
          res.statusCode = 404
          return res.end('not found')
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'install.sh',
        source: readTemplate('__PANEL_URL__'),
      })
      this.emitFile({
        type: 'asset',
        fileName: 'gost-logfeed.mjs',
        source: fs.readFileSync(LOGFEED_MJS, 'utf8'),
      })
      if (fs.existsSync(DL_DIR)) {
        for (const f of fs.readdirSync(DL_DIR)) {
          const full = path.join(DL_DIR, f)
          if (fs.statSync(full).isFile()) {
            this.emitFile({
              type: 'asset',
              fileName: `dl/${f}`,
              source: fs.readFileSync(full),
            })
          }
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), gostPanelBootstrap()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5273,
    strictPort: true,
    proxy: {
      '/proxy-metrics': {
        target: process.env.VITE_GOST_METRICS_TARGET ?? 'http://192.168.193.130:9000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy-metrics/, '/metrics'),
      },
      '/proxy-logs': {
        target: process.env.VITE_GOST_LOGFEED_TARGET ?? 'http://192.168.193.130:19090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy-logs/, ''),
      },
    },
  },
})
