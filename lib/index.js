// POI Host: local configuration, fixed assets and web index injection.
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULTS, normalize, resetGroup } from './config.js'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup.json')

const NS = 'poi-theme-dsh-startup-screen'
const ROUTE_BASE = '/dsh-startup'
// This symbol survives plugin module/effect reloads and ends with the owning Host process.
const launchKey = Symbol.for(NS + '/host-launch')
const LAUNCH_ID = (globalThis[launchKey] ||= randomUUID())

/** 插件版本：读自己的 package.json，避免源码与版本号两处各写一份。
    读不到就退回占位符（设置页会显示它，不会显示 undefined）。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')
    )
    const v = String(pkg.version || '').trim()
    return v || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next, changed) {
  const cfg = normalize(next, changed)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/** 静态文件按 mtime 缓存，改完插件刷新页面即生效。 */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const cssReaders = [
  'lib/splash.css',
  'lib/views/terminal.css',
  'lib/views/retrieval.css'
].map(makeReader)
const scriptReaders = [
  'lib/views/terminal.js',
  'lib/views/retrieval.js',
  'lib/splash.js'
].map(makeReader)
const readSplashCss = () => cssReaders.map((read) => read()).join('\n')
const readSplashJs = () => scriptReaders.map((read) => read()).join('\n;\n')

/** 内联脚本里绝对不能出现 `</script>`。 */
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028|\u2029/g, '')
}

/** The inline cover and its deadline do not wait for external stylesheets. */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important}',
  'html.dsu-lock body{background-color:#F0EFF2!important}',
  '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#F0EFF2}'
].join('')

function bootstrap() {
  const config = window.__DSH_STARTUP__ || {}
  const launchId = window.__DSH_STARTUP_LAUNCH_ID__
  let skip = !config.enabled || config.mode === 'manual'
  try {
    if (config.mode === 'session')
      skip ||= localStorage.getItem('poi-theme-dsh-startup-screen:launch') === launchId
    if (config.mode === 'daily')
      skip ||=
        localStorage.getItem('poi-theme-dsh-startup-screen:day') ===
        new Date().toLocaleDateString('en-CA')
    if (!skip) {
      if (config.mode === 'session')
        localStorage.setItem('poi-theme-dsh-startup-screen:launch', launchId)
      if (config.mode === 'daily')
        localStorage.setItem(
          'poi-theme-dsh-startup-screen:day',
          new Date().toLocaleDateString('en-CA')
        )
    }
  } catch {
    /* Unavailable storage must not leave a cover locked. */
  }
  window.__DSH_STARTUP_SKIP__ = skip
  function uncover() {
    document.getElementById('dsh-startup-root')?.remove()
    document.documentElement.classList.remove('dsu-lock')
  }
  if (skip) {
    uncover()
    return
  }
  document.documentElement.classList.add('dsu-lock')
  let link,
    script,
    ended = false
  const timeout = setTimeout(() => cancel(), 1000)
  const shown = () => {
    ended = true
    clearTimeout(timeout)
    window.removeEventListener('dsh-startup:stage', shown)
  }
  function cancel() {
    if (ended) return
    ended = true
    clearTimeout(timeout)
    window.removeEventListener('dsh-startup:stage', shown)
    window.__DSH_STARTUP_SKIP__ = true
    window.__DSH_STARTUP_FAILED__ = true
    link?.remove()
    script?.remove()
    uncover()
  }
  window.__DSH_STARTUP_CANCEL_BOOT__ = cancel
  window.addEventListener('dsh-startup:stage', shown, { once: true })
  link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/dsh-startup/splash.css'
  link.onerror = cancel
  link.onload = () => {
    if (ended) return
    script = document.createElement('script')
    script.src = '/dsh-startup/splash.js'
    script.dataset.poiBoot = 'automatic'
    script.onerror = cancel
    document.head.append(script)
  }
  document.head.append(link)
}
const BOOTSTRAP_JS = '(' + bootstrap.toString() + ')()'

const name = NS
const inject = ['webServer', 'connection']

/** Resource service used by web index injection and desktop protocol forwarding. */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) {
    /* 取不到就当没有 */
  }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  // Resource routes are required by both web index injection and desktop selfBoot.
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' +
          NS +
          '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
          '资源路由不可用，本次跳过启动动画。'
      )
    } catch (err) {
      /* 日志失败不影响加载 */
    }
    return
  }

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn =
        (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) ||
        ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  disposers.push(
    registerRoute({
      kind: 'exact',
      path: ROUTE_BASE + '/splash.css',
      handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readSplashCss())
    })
  )

  disposers.push(
    registerRoute({
      kind: 'exact',
      path: ROUTE_BASE + '/splash.js',
      handler: (req, res) =>
        sendText(res, 'application/javascript; charset=utf-8', readSplashJs())
    })
  )

  const assetTypes = {
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.ttf': 'font/ttf'
  }
  const assetNames = new Set(fs.readdirSync(path.join(PACKAGE_ROOT, 'lib/assets')))
  disposers.push(
    registerRoute({
      kind: 'prefix',
      path: ROUTE_BASE + '/asset',
      handler: (req, res) => {
        if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
          res.writeHead(405)
          res.end()
          return
        }
        let name
        try {
          name = decodeURIComponent(
            (req.url || '').split('?')[0].slice((ROUTE_BASE + '/asset/').length)
          )
        } catch {
          res.writeHead(400)
          res.end()
          return
        }
        const type = assetTypes[path.extname(name)]
        if (
          !assetNames.has(name) ||
          !type ||
          name.includes('/') ||
          name.includes('\\') ||
          name.includes('..')
        ) {
          res.writeHead(404)
          res.end()
          return
        }
        try {
          const bytes = fs.readFileSync(path.join(PACKAGE_ROOT, 'lib/assets', name))
          res.writeHead(200, {
            'Content-Type': type,
            'Cache-Control': 'no-cache',
            'Content-Length': String(bytes.length)
          })
          res.end(req.method === 'HEAD' ? undefined : bytes)
        } catch {
          res.writeHead(404)
          res.end()
        }
      }
    })
  )

  disposers.push(
    registerRoute({
      kind: 'exact',
      path: ROUTE_BASE + '/config',
      handler: async (req, res) => {
        const method = (req.method || 'GET').toUpperCase()
        if (method === 'GET') {
          sendJson(res, 200, {
            ok: true,
            version: PLUGIN_VERSION,
            launchId: LAUNCH_ID,
            config: readConfig(),
            defaults: DEFAULTS,
            file: CONFIG_FILE
          })
          return
        }
        if (method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        const text = await readBody(req)
        let payload = {}
        try {
          payload = text ? JSON.parse(text) : {}
        } catch (err) {
          sendJson(res, 400, { ok: false, error: 'invalid json' })
          return
        }
        try {
          if (payload && payload.action === 'reset') {
            const cfgNow = writeConfig(
              payload.group && ['common', 'advanced'].includes(payload.group)
                ? resetGroup(readConfig(), payload.group)
                : DEFAULTS
            )
            sendJson(res, 200, {
              ok: true,
              version: PLUGIN_VERSION,
              config: cfgNow,
              defaults: DEFAULTS
            })
            return
          }
          const current = readConfig()
          const patch =
            payload && typeof payload.patch === 'object' && payload.patch
              ? payload.patch
              : payload
          if (Object.hasOwn(patch, 'stageDurations')) {
            const stages = patch.stageDurations
            const valid =
              Array.isArray(stages) &&
              stages.length === 10 &&
              stages.every(
                (value) =>
                  Number.isFinite(Number(value)) &&
                  Number(value) >= 0.001 &&
                  Number(value) <= 15
              )
            const total = valid
              ? stages.reduce((sum, value) => sum + Number(value), 0)
              : NaN
            if (!valid || total < 6 - 0.000001 || total > 15 + 0.000001) {
              sendJson(res, 400, {
                ok: false,
                error: '各阶段总时长需为 6–15 秒，且每阶段至少 0.001 秒。'
              })
              return
            }
          } else if (
            Object.hasOwn(patch, 'duration') &&
            (!Number.isFinite(Number(patch.duration)) ||
              Number(patch.duration) < 6 ||
              Number(patch.duration) > 15)
          ) {
            sendJson(res, 400, { ok: false, error: '总时长需为 6–15 秒。' })
            return
          }
          const next = normalize({ ...current, ...patch }, patch)
          if (next.stageDurations.some((value) => value < 0.001)) {
            sendJson(res, 400, {
              ok: false,
              error: '每阶段至少 0.001 秒，请先调整过短的阶段时长。'
            })
            return
          }
          const cfgNow = writeConfig(next)
          sendJson(res, 200, {
            ok: true,
            version: PLUGIN_VERSION,
            launchId: LAUNCH_ID,
            config: cfgNow,
            defaults: DEFAULTS
          })
        } catch (err) {
          sendJson(res, 500, {
            ok: false,
            error: String((err && err.message) || err)
          })
        }
      }
    })
  )

  // Structured index-injection rows feed BOTH index renderers: the served web
  // index (renderIndex renders rows into the HTML text) and the desktop main
  // window, whose dsh-app:// index bypasses this webserver entirely and
  // replays the same rows through the boot IPC interpreter BEFORE React
  // mounts. The previous tapIndex-only injection never reached the desktop,
  // so its cover arrived only after the app had painted — the startup flash.
  ctx.on('webserver/index-inject', (table) => {
    const cfg = readConfig()
    table.push(
      { kind: 'style', text: CRITICAL_CSS },
      { kind: 'global', name: '__DSH_STARTUP_BOOT__', value: 'index' },
      { kind: 'global', name: '__DSH_STARTUP_VERSION__', value: PLUGIN_VERSION },
      { kind: 'global', name: '__DSH_STARTUP_LAUNCH_ID__', value: LAUNCH_ID },
      { kind: 'global', name: '__DSH_STARTUP__', value: cfg },
      {
        kind: 'html',
        placement: 'body',
        html: '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>'
      },
      { kind: 'script', placement: 'body', text: BOOTSTRAP_JS }
    )
  })

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch (err) {
        /* noop */
      }
    }
  })
}

/* 导出形状对齐 DSH 内部插件（如 dsh-host-open-in-app）：
   只给具名 name / inject / apply。
   两点刻意不做：
   1) 不导出 default —— cordis-plugin-loader 的 unwrapExports 是
      `exports.default ?? exports`，一旦有 default 就只认 default，
      两边都写反而多一个"改一处忘一处"的坑；
   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
      我这份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。 */
export { apply, inject, name }
