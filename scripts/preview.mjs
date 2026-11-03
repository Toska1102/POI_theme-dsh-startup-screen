// Local-only preview. Configuration is isolated from the user's DSH profile.
import http from 'node:http'
import { build } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-preview-'))
process.env.DSH_HOME = home
const { apply } = await import('../lib/index.js')
const routes = [],
  taps = []
apply({
  webServer: {
    register(route) {
      routes.push(route)
      return () => {}
    },
    tapIndex(tap) {
      taps.push(tap)
      return () => {}
    }
  },
  effect() {},
  connection: {
    requestRejection(req) {
      const origin = req.headers.origin
      return origin && origin !== `http://${req.headers.host}` ? 403 : undefined
    }
  }
})
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./preview-client.jsx', import.meta.url))],
  bundle: true,
  write: false,
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' }
})
const html = fs.readFileSync(
  fileURLToPath(new URL('../preview/index.html', import.meta.url)),
  'utf8'
)
const server = http.createServer(async (req, res) => {
  try {
    const route = routes.find(r =>
      r.kind === 'exact' ? req.url.split('?')[0] === r.path : req.url.startsWith(r.path)
    )
    if (route) {
      await route.handler(req, res)
      return
    }
    if (req.url === '/' || req.url.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(req.url.includes('desktop=1') ? html : taps.reduce((text, tap) => tap(text), html))
      return
    }
    if (req.url === '/preview-react.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      res.end(bundle.outputFiles[0].contents)
      return
    }
    if (req.url === '/preview-client.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      res.end(fs.readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url))))
      return
    }
    res.writeHead(404)
    res.end()
  } catch (error) {
    res.writeHead(500)
    res.end(error.message)
  }
})
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log(`POI preview: http://127.0.0.1:${server.address().port}`)
)
function close() {
  server.close(() => {
    fs.rmSync(home, { recursive: true, force: true })
    process.exit()
  })
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
