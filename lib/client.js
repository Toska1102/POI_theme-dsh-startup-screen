/* DSH ModuleLoader entry. React and settings slots are provided by the host. */
window.__ModuleLoader__.load({
  id: 'poi-theme-dsh-startup-screen',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const API = '/dsh-startup/config'
    let runtimeLoading = null
    const css = document.createElement('style')
    css.dataset.pluginCss = 'poi-theme-dsh-startup-screen/main.css'
    css.textContent = `.poi-settings{max-width:640px;display:grid;gap:20px;font-size:14px}.poi-settings fieldset{border:1px solid var(--dsw-alias-border-l2,#7775);border-radius:8px;padding:18px;display:grid;gap:16px}.poi-settings legend{padding:0 8px}.poi-setting{display:flex;align-items:center;justify-content:space-between;gap:24px}.poi-setting input:not([type=checkbox]),.poi-setting select{max-width:260px;width:50%;min-height:32px;padding:4px 8px;color:inherit;background:var(--dsw-alias-bg-layer-1,transparent);border:1px solid #7776;border-radius:4px}.poi-setting input[type=range]{padding:0}.poi-setting small{display:block;opacity:.65;margin-top:4px}.poi-setting input[type=checkbox]{width:18px;height:18px}.poi-settings-actions{position:sticky;bottom:0;background:var(--dsw-alias-bg-layer-1,#17191c);display:flex;flex-wrap:wrap;gap:10px;padding:14px 0}.poi-settings button{min-height:36px;padding:6px 14px;font:inherit;cursor:pointer;border:1px solid #7776;border-radius:5px;background:transparent;color:inherit}.poi-settings button:disabled{opacity:.5;cursor:default}.poi-settings button:first-child{background:#e5d530;color:#101114}.poi-settings-note{font-size:12px;opacity:.7;line-height:1.6}.poi-settings-error{color:#eb6571}`
    document.head.append(css)

    async function request(init) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(API, { ...init, signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.ok) throw new Error(result.error || '配置请求失败')
        return result
      } finally {
        clearTimeout(timeout)
      }
    }
    function ensureRuntime() {
      if (runtimeLoading) return runtimeLoading
      runtimeLoading = new Promise((resolve, reject) => {
        const existing = document.querySelector('link[href="/dsh-startup/splash.css"]')
        const link = existing || document.createElement('link')
        let script
        const timeout = setTimeout(() => failed(new Error('启动资源加载超时')), 9000)
        function failed(error) {
          clearTimeout(timeout)
          script?.remove()
          if (!existing) link.remove()
          runtimeLoading = null
          reject(error)
        }
        function loadScript() {
          if (window.__DSH_STARTUP_API__) {
            clearTimeout(timeout)
            resolve(window.__DSH_STARTUP_API__)
            return
          }
          script = document.createElement('script')
          script.src = '/dsh-startup/splash.js'
          script.onload = () => {
            clearTimeout(timeout)
            if (window.__DSH_STARTUP_API__) resolve(window.__DSH_STARTUP_API__)
            else failed(new Error('启动脚本未初始化'))
          }
          script.onerror = () => failed(new Error('启动脚本加载失败'))
          document.head.append(script)
        }
        if (link.sheet) loadScript()
        else {
          link.onload = loadScript
          link.onerror = () => failed(new Error('启动样式加载失败'))
          if (!existing) {
            link.rel = 'stylesheet'
            link.href = '/dsh-startup/splash.css'
            document.head.append(link)
          }
        }
      })
      return runtimeLoading
    }
    async function selfBoot() {
      if (window.__DSH_STARTUP_BOOT__ || window.__DSH_STARTUP_API__) return
      window.__DSH_STARTUP_BOOT__ = 'client'
      try {
        const { config } = await request()
        window.__DSH_STARTUP__ = config
        let shown = false
        try {
          shown =
            (config.mode === 'session' &&
              sessionStorage.getItem('poi-theme-dsh-startup-screen:shown') === '1') ||
            (config.mode === 'daily' &&
              localStorage.getItem('poi-theme-dsh-startup-screen:day') ===
                new Date().toLocaleDateString('en-CA'))
        } catch {
          /* Storage can be unavailable. */
        }
        window.__DSH_STARTUP_SKIP__ = !config.enabled || shown
        await ensureRuntime()
      } catch (error) {
        window.__DSH_STARTUP_FAILED__ = true
        document.getElementById('dsh-startup-root')?.remove()
        document.documentElement.classList.remove('dsu-lock')
        console.warn('[POI startup] 客户端启动失败，保留主界面', error)
      }
    }
    function Panel() {
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(null)
      const [version, setVersion] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
      function loaded(result) {
        setDraft(result.config)
        setSaved(result.config)
        setVersion(result.version || '')
        window.__DSH_STARTUP__ = { ...result.config }
        if (window.__DSH_STARTUP_API__) window.__DSH_STARTUP_API__.config = { ...result.config }
      }
      async function load() {
        setBusy(true)
        setError('')
        try {
          loaded(await request())
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }
      React.useEffect(() => {
        load()
      }, [])
      async function save(reset = false) {
        setBusy(true)
        setError('')
        setNotice('')
        try {
          loaded(
            await request({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reset ? { action: 'reset' } : { patch: draft })
            })
          )
          setNotice(reset ? '已恢复默认。' : '已保存，可立即预览。')
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }
      async function preview() {
        setBusy(true)
        setError('')
        try {
          // A skipped initial boot must not start a second instance while loading the runtime.
          window.__DSH_STARTUP_SKIP__ = true
          const runtime = await ensureRuntime()
          runtime.replay(saved)
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }
      const set = (key, value) => {
        setDraft(d => ({ ...d, [key]: value }))
        setNotice('')
      }
      function field(label, key, type = 'text', extra = {}) {
        return h(
          'label',
          { className: 'poi-setting', key },
          h('span', null, label),
          h('input', {
            type,
            disabled: busy,
            ...extra,
            ...(type === 'checkbox' ? { checked: !!draft[key] } : { value: draft[key] }),
            onChange: e =>
              set(
                key,
                type === 'checkbox'
                  ? e.target.checked
                  : type === 'range'
                    ? Number(e.target.value)
                    : e.target.value
              )
          })
        )
      }
      const message = error
        ? h('p', { role: 'alert', className: 'poi-settings-error' }, error)
        : h('p', { role: 'status' }, notice)
      if (!draft)
        return h(
          'div',
          { className: 'poi-settings' },
          message,
          h('button', { onClick: load, disabled: busy }, busy ? '读取配置…' : '重新读取')
        )
      return h(
        'div',
        { className: 'poi-settings' },
        h(
          'div',
          null,
          h('h2', null, 'THE MACHINE'),
          h(
            'p',
            { className: 'poi-settings-note' },
            `POI 启动序列 · ${version} · 身份与权限信息用于启动叙事。`
          )
        ),
        h(
          'fieldset',
          null,
          h('legend', null, '身份'),
          field('名称', 'identity', 'text', { maxLength: 48 }),
          field('编号', 'identityId', 'text', { maxLength: 16 }),
          field('展示权限等级', 'accessLevel', 'text', { maxLength: 16 })
        ),
        h(
          'fieldset',
          null,
          h('legend', null, '播放'),
          field('启用启动动画', 'enabled', 'checkbox'),
          h(
            'label',
            { className: 'poi-setting' },
            '显示模式',
            h(
              'select',
              { value: draft.mode, disabled: busy, onChange: e => set('mode', e.target.value) },
              [
                ['always', '每次打开'],
                ['session', '每个会话'],
                ['daily', '每天一次']
              ].map(([value, label]) => h('option', { value, key: value }, label))
            )
          ),
          field('要求两次确认', 'requireInteraction', 'checkbox'),
          field('允许跳过', 'allowSkip', 'checkbox'),
          field(`视觉速度 ${draft.speed.toFixed(2)}×`, 'speed', 'range', {
            min: 0.35,
            max: 3,
            step: 0.05
          }),
          h(
            'p',
            { className: 'poi-settings-note' },
            '人声保持原速。自动播放模式在首次点击前保持静音。'
          )
        ),
        h(
          'fieldset',
          null,
          h('legend', null, '声音'),
          field('人声', 'voice', 'checkbox'),
          field(`人声音量 ${Math.round(draft.voiceVolume * 100)}%`, 'voiceVolume', 'range', {
            min: 0,
            max: 1,
            step: 0.05
          }),
          field('界面音效', 'sound', 'checkbox'),
          field(`音效音量 ${Math.round(draft.soundVolume * 100)}%`, 'soundVolume', 'range', {
            min: 0,
            max: 1,
            step: 0.05
          })
        ),
        message,
        h(
          'div',
          { className: 'poi-settings-actions' },
          h('button', { onClick: () => save(), disabled: busy || !dirty }, '保存'),
          h('button', { onClick: preview, disabled: busy }, '预览已保存配置'),
          h('button', { onClick: () => save(true), disabled: busy }, '恢复默认'),
          h(
            'button',
            {
              onClick: () => {
                setDraft({ ...saved })
                setNotice('已放弃修改。')
              },
              disabled: busy || !dirty
            },
            '放弃修改'
          ),
          dirty ? h('span', null, '● 未保存') : null
        )
      )
    }
    function apply(ctx) {
      selfBoot()
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          { name: 'settings.section', id: 'startup-screen', order: 26, label: 'POI 启动动画' },
          () => h(Panel)
        )
      )
      ctx.effect?.(() => () => {
        window.__DSH_STARTUP_API__?.dispose()
        css.remove()
      })
    }
    return { inject: ['slots'], apply }
  }
})
