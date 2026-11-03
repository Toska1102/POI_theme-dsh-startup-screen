// POI Host: local configuration, fixed assets and web index injection.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULTS, normalize, resetGroup } from './config.js'

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup.json')

const NS = 'poi-theme-dsh-startup-screen'
const ROUTE_BASE = '/dsh-startup'

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

/** 首屏兜底：在应用挂载前先把窗口盖住，避免闪出界面本体。 */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important}',
  /* DSH 0.2.1 起 index.html 会先写一条 :root{color-scheme:light}body{background-color:#fff;--dsh-boot-bg:#fff}，
     我们的覆盖层插入前/玻璃透明时都会露出这层白 → 启动期一律压成黑色（与黑幕开场一致）。 */
  'html.dsu-lock body{background-color:#000!important}',
  ':root{--dsh-boot-bg:#000}',
  '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}'
].join('')

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
var root=document.getElementById('dsh-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('poi-theme-dsh-startup-screen:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('poi-theme-dsh-startup-screen:day')===new Date().toLocaleDateString('en-CA'))off=true;
if(off){window.__DSH_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{document.documentElement.classList.add('dsu-lock');/* 兜底：连 splash.js 都没跑起来（404/被拦/语法错）时，9 秒后无条件放行，绝不锁黑屏。判据是「时间线有没有开始跑」而不是类名 —— dsu-boot 在 run() 之前就被摘掉，按类名判等于永不生效 */setTimeout(function(){try{if(window.__DSH_STARTUP_RUNNING__===true)return;var r=document.getElementById('dsh-startup-root');if(!r)return;if(r&&r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_STARTUP_FAILED__=true;}catch(e){}},9000);}
}catch(e){} })()`

const name = NS
const inject = ['webServer', 'connection']

/** Resource service used by web index injection and desktop protocol forwarding. */
function resolveWebServer(ctx) {
  try {
    const viaGet =
      typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
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
      handler: (req, res) =>
        sendText(res, 'text/css; charset=utf-8', readSplashCss())
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
  const assetNames = new Set(
    fs.readdirSync(path.join(PACKAGE_ROOT, 'lib/assets'))
  )
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
          const bytes = fs.readFileSync(
            path.join(PACKAGE_ROOT, 'lib/assets', name)
          )
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
                  Number(value) > 0 &&
                  Number(value) <= 15
              )
            const total = valid
              ? stages.reduce((sum, value) => sum + Number(value), 0)
              : NaN
            if (!valid || total < 6 - 0.000001 || total > 15 + 0.000001) {
              sendJson(res, 400, {
                ok: false,
                error: '各阶段总时长需为 6–15 秒，且每阶段时长需大于零。'
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
          const cfgNow = writeConfig({ ...current, ...patch }, patch)
          sendJson(res, 200, {
            ok: true,
            version: PLUGIN_VERSION,
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

  if (typeof webServer.tapIndex === 'function')
    disposers.push(
      webServer.tapIndex((html) => {
        if (!html || html.includes(ROUTE_BASE + '/splash.js')) return html
        const cfg = readConfig()
        const head =
          '<link rel="stylesheet" href="' +
          ROUTE_BASE +
          '/splash.css">' +
          '<style id="dsh-startup-critical">' +
          CRITICAL_CSS +
          '</style>'
        const body =
          '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>' +
          '<script>window.__DSH_STARTUP_BOOT__="index";window.__DSH_STARTUP_VERSION__=' +
          safeJson(PLUGIN_VERSION) +
          ';window.__DSH_STARTUP__=' +
          safeJson(cfg) +
          ';' +
          BOOTSTRAP_JS +
          '</script>' +
          '<script defer src="' +
          ROUTE_BASE +
          '/splash.js"></script>'

        let out = html
        if (out.includes('</head>'))
          out = out.replace('</head>', head + '</head>')
        else out = head + out
        if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
        else if (out.includes('</body>'))
          out = out.replace('</body>', body + '</body>')
        else out = out + body
        return out
      })
    )

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
