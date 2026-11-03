import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DEFAULTS, normalize } from '../lib/config.js'
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'poi-host-test-'))
process.env.DSH_HOME = home
const plugin = await import('../lib/index.js')
after(() => fs.rmSync(home, { recursive: true, force: true }))
const routes = [],
  taps = [],
  disposers = []
let reject = false
plugin.apply({
  webServer: {
    register(r) {
      routes.push(r)
      return () => {}
    },
    tapIndex(t) {
      taps.push(t)
      return () => {}
    }
  },
  effect(fn) {
    disposers.push(fn())
  },
  connection: {
    requestRejection() {
      return reject ? 403 : undefined
    }
  }
})
async function request(url, method = 'GET', body) {
  const req = new EventEmitter()
  Object.assign(req, { url, method, destroy() {} })
  const res = {
    statusCode: 200,
    headers: {},
    writeHead(status, headers = {}) {
      this.statusCode = status
      this.headers = headers
    },
    end(bytes) {
      this.body = Buffer.from(bytes || '')
    }
  }
  // DSH WebServer.match(): exact first, then longest complete path prefix.
  const pathname = new URL(url, 'http://localhost').pathname
  const route =
    routes.find(r => r.kind === 'exact' && r.path === pathname) ||
    routes
      .filter(
        r => r.kind === 'prefix' && (pathname === r.path || pathname.startsWith(`${r.path}/`))
      )
      .sort((a, b) => b.path.length - a.path.length)[0]
  if (!route) {
    res.writeHead(404)
    res.end()
    return res
  }
  const done = route.handler(req, res)
  if (method === 'POST') {
    if (body) req.emit('data', Buffer.from(body))
    req.emit('end')
  }
  await done
  return res
}
test('DSH loader export contract and lifecycle', () => {
  assert.equal(plugin.name, 'dsh-startup-screen')
  assert.equal(plugin.default, undefined)
  assert.equal(plugin.Config, undefined)
  assert.deepEqual(plugin.inject, ['webServer', 'connection'])
  assert.equal(routes.length, 4)
  assert.equal(disposers.length, 1)
})
test('normalization retains POI settings and removes legacy visual fields', () => {
  const c = normalize({
    identity: '人豪',
    identityId: '测试-01',
    speed: 999,
    voiceVolume: -1,
    theme: 'light',
    glass: true,
    enabled: 'true'
  })
  assert.equal(c.identity, '人豪')
  assert.equal(c.identityId, '测试-01')
  assert.equal(c.speed, 3)
  assert.equal(c.voiceVolume, 0)
  assert.equal(c.theme, undefined)
  assert.equal(c.glass, undefined)
  assert.equal(c.enabled, true)
  assert.equal(normalize({ speed: 'bad', mode: 'bad' }).speed, 1)
})
test('configuration roundtrip, patch, reset and malformed input', async () => {
  let r = await request('/dsh-startup/config')
  assert.deepEqual(JSON.parse(r.body).config, DEFAULTS)
  r = await request(
    '/dsh-startup/config',
    'POST',
    JSON.stringify({ patch: { identity: 'NEW', glass: true } })
  )
  assert.equal(JSON.parse(r.body).config.identity, 'NEW')
  assert.equal(JSON.parse(r.body).config.glass, undefined)
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'dsh-startup.json'))).identity, 'NEW')
  assert.equal((await request('/dsh-startup/config', 'POST', '{')).statusCode, 400)
  assert.equal((await request('/dsh-startup/config', 'DELETE')).statusCode, 405)
  r = await request('/dsh-startup/config', 'POST', '{"action":"reset"}')
  assert.deepEqual(JSON.parse(r.body).config, DEFAULTS)
})
test('all fixed images, human voices and fonts are served with correct MIME', async () => {
  for (const file of [
    'camera-a.png',
    'camera-b.png',
    'camera-c.png',
    'camera-d.png',
    'Michroma-Regular.ttf',
    'VT323-Regular.ttf',
    'ShareTechMono-Regular.ttf',
    ...Array.from({ length: 6 }, (_, i) => `line-${i + 1}.mp3`)
  ]) {
    const r = await request('/dsh-startup/asset/' + file)
    assert.equal(r.statusCode, 200, file)
    assert.ok(r.body.length > 1000, file)
    assert.equal(
      r.headers['Content-Type'],
      file.endsWith('png') ? 'image/png' : file.endsWith('ttf') ? 'font/ttf' : 'audio/mpeg'
    )
  }
  for (const file of [
    '../package.json',
    '%2e%2e%2fpackage.json',
    'missing.png',
    '%ZZ',
    'camera-a.png/other'
  ])
    assert.ok((await request('/dsh-startup/asset/' + file)).statusCode >= 400)
  assert.equal((await request('/dsh-startup/asset/camera-a.png', 'HEAD')).body.length, 0)
})
test('trust rejection precedes all route responses', async () => {
  reject = true
  try {
    const r = await request('/dsh-startup/config')
    assert.equal(r.statusCode, 403)
    assert.equal(r.body.length, 0)
  } finally {
    reject = false
  }
})
test('safe, idempotent web index injection preserves the host', async () => {
  await request(
    '/dsh-startup/config',
    'POST',
    JSON.stringify({ patch: { identity: '</script><img src=x>' } })
  )
  const html = '<html><head></head><body><main id="root"></main></body></html>'
  const injected = taps[0](html)
  assert.ok(injected.includes('\\u003c/script>'))
  assert.ok(injected.includes('<main id="root">'))
  assert.equal(taps[0](injected), injected)
  assert.ok(injected.includes('defer src="/dsh-startup/splash.js"'))
})
test('route-only desktop host does not require tapIndex', () => {
  const registered = []
  plugin.apply({
    webServer: {
      register(r) {
        registered.push(r)
        return () => {}
      }
    },
    effect() {}
  })
  assert.equal(registered.length, 4)
  assert.doesNotThrow(() => plugin.apply({ logger: { warn() {} } }))
})

test('DSH path-prefix contract accepts asset queries and rejects sibling prefixes', async () => {
  assert.equal((await request('/dsh-startup/asset/camera-b.png?v=2')).statusCode, 200)
  assert.equal((await request('/dsh-startup/asset')).statusCode, 404)
  assert.equal((await request('/dsh-startup/asset-other/camera-b.png')).statusCode, 404)
})
