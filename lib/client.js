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
        const response = await fetch(API, {
          ...init,
          signal: controller.signal
        })
        const result = await response.json()
        if (!response.ok || !result.ok)
          throw new Error(result.error || '配置请求失败')
        return result
      } finally {
        clearTimeout(timeout)
      }
    }
    function ensureRuntime() {
      if (runtimeLoading) return runtimeLoading
      runtimeLoading = new Promise((resolve, reject) => {
        const existing = document.querySelector(
          'link[href="/dsh-startup/splash.css"]'
        )
        const link = existing || document.createElement('link')
        let script
        const timeout = setTimeout(
          () => failed(new Error('启动资源加载超时')),
          9000
        )
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
              sessionStorage.getItem('poi-theme-dsh-startup-screen:shown') ===
                '1') ||
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
      const [defaults, setDefaults] = React.useState(null)
      const [version, setVersion] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const copy = (value) => JSON.parse(JSON.stringify(value))
      const advancedKeys = [
        'stageDurations',
        'cameraMotion',
        'scanSpeed',
        'lockSpeed',
        'effectIntensity',
        'reducedMotion'
      ]
      const stageLabels = [
        '监控终端启动',
        '监控信号接入',
        '系统初始化',
        '访问授权',
        '身份资料确认',
        '检索初始化',
        '关键帧定位',
        '实体锁定',
        '计算响应',
        '终幕移交'
      ]
      const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
      function loaded(result) {
        setDraft(copy(result.config))
        setSaved(copy(result.config))
        setDefaults(copy(result.defaults))
        setVersion(result.version || '')
        window.__DSH_STARTUP__ = copy(result.config)
        if (window.__DSH_STARTUP_API__)
          window.__DSH_STARTUP_API__.config = copy(result.config)
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
      async function save() {
        setBusy(true)
        setError('')
        setNotice('')
        try {
          if (draft.duration < 6 || draft.duration > 15)
            throw new Error('各阶段总时长需为 6–15 秒，请调整后保存。')
          loaded(
            await request({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patch: draft })
            })
          )
          setNotice('已保存，可立即预览。')
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
          window.__DSH_STARTUP_SKIP__ = true
          const runtime = await ensureRuntime()
          runtime.replay(saved)
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }
      function set(key, value) {
        setDraft((previous) => {
          const next = { ...previous, [key]: value }
          if (
            key === 'duration' &&
            Number.isFinite(value) &&
            value >= 6 &&
            value <= 15
          ) {
            next.stageDurations = previous.stageDurations.map(
              (stage) =>
                (stage * value) /
                previous.stageDurations.reduce(
                  (sum, duration) => sum + duration,
                  0
                )
            )
          }
          return next
        })
        setError('')
        setNotice('')
      }
      function setStage(index, value) {
        setDraft((previous) => {
          const stages = [...previous.stageDurations]
          stages[index] = Number(value)
          return {
            ...previous,
            stageDurations: stages,
            duration: Number(stages.reduce((a, b) => a + b, 0).toFixed(6))
          }
        })
        setError('')
        setNotice('')
      }
      function reset(group) {
        setDraft((previous) => {
          const next = copy(previous)
          const keys =
            group === 'advanced'
              ? advancedKeys
              : Object.keys(defaults).filter(
                  (key) => !advancedKeys.includes(key)
                )
          for (const key of keys) next[key] = copy(defaults[key])
          if (group === 'advanced')
            next.stageDurations = defaults.stageDurations.map(
              (stage) => (stage * previous.duration) / defaults.duration
            )
          else
            next.stageDurations = previous.stageDurations.map(
              (stage) =>
                (stage * defaults.duration) /
                previous.stageDurations.reduce(
                  (sum, duration) => sum + duration,
                  0
                )
            )
          return next
        })
        setError('')
        setNotice('已恢复该组默认，保存后生效。')
      }
      function field(label, key, type = 'text', extra = {}) {
        return h(
          'label',
          { className: 'poi-setting', key },
          h('span', null, label),
          h('input', {
            type,
            disabled: busy,
            'aria-label': label,
            ...extra,
            ...(type === 'checkbox'
              ? { checked: !!draft[key] }
              : { value: draft[key] }),
            onChange: (e) =>
              set(
                key,
                type === 'checkbox'
                  ? e.target.checked
                  : ['number', 'range'].includes(type)
                    ? Number(e.target.value)
                    : e.target.value
              )
          })
        )
      }
      function select(label, key, choices) {
        return h(
          'label',
          { className: 'poi-setting', key },
          h('span', null, label),
          h(
            'select',
            {
              value: draft[key],
              disabled: busy,
              'aria-label': label,
              onChange: (e) => set(key, e.target.value)
            },
            choices.map(([value, text]) =>
              h('option', { value, key: value }, text)
            )
          )
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
          h(
            'button',
            { onClick: load, disabled: busy },
            busy ? '读取配置…' : '重新读取'
          )
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
          h('legend', null, '常用设置'),
          field('名称', 'identity', 'text', { maxLength: 48 }),
          field('编号', 'identityId', 'text', { maxLength: 16 }),
          field('展示权限等级', 'accessLevel', 'text', { maxLength: 16 }),
          field('启用启动动画', 'enabled', 'checkbox'),
          select('播放频率', 'mode', [
            ['session', '每次启动'],
            ['daily', '每天首次'],
            ['manual', '仅手动播放']
          ]),
          field('总时长（秒）', 'duration', 'number', {
            min: 6,
            max: 15,
            step: 0.1
          }),
          h(
            'p',
            { className: 'poi-settings-note' },
            '人工确认等待另计。启用人声时，阶段等待录音结束，实际时长可能增加。'
          ),
          field('允许跳过', 'allowSkip', 'checkbox'),
          field('终幕文案', 'terminalText', 'text', { maxLength: 160 }),
          field('人声', 'voice', 'checkbox'),
          field('人声音量', 'voiceVolume', 'range', {
            min: 0,
            max: 1,
            step: 0.05
          }),
          field('界面音效', 'sound', 'checkbox'),
          field('音效音量', 'soundVolume', 'range', {
            min: 0,
            max: 1,
            step: 0.05
          }),
          h(
            'button',
            { onClick: () => reset('common'), disabled: busy },
            '恢复常用默认'
          )
        ),
        h(
          'details',
          null,
          h('summary', null, '高级设置'),
          h(
            'fieldset',
            null,
            h('legend', null, '动态效果与阶段时长'),
            field('镜头运动', 'cameraMotion', 'checkbox'),
            field('扫描速度', 'scanSpeed', 'number', {
              min: 0.5,
              max: 2,
              step: 0.1
            }),
            field('锁定速度', 'lockSpeed', 'number', {
              min: 0.5,
              max: 2,
              step: 0.1
            }),
            field('动态效果强度', 'effectIntensity', 'range', {
              min: 0,
              max: 1,
              step: 0.05
            }),
            select('减少动态效果', 'reducedMotion', [
              ['system', '跟随系统'],
              ['reduce', '减少动态效果'],
              ['full', '完整动态效果']
            ]),
            ...stageLabels.map((label, index) =>
              h(
                'label',
                { className: 'poi-setting', key: index },
                h(
                  'span',
                  null,
                  `${String(index).padStart(2, '0')} ${label}（秒）`
                ),
                h('input', {
                  type: 'number',
                  min: 0.001,
                  max: 15,
                  step: 0.01,
                  disabled: busy,
                  'aria-label': `${label}时长（秒）`,
                  value: Number(draft.stageDurations[index].toFixed(6)),
                  onChange: (e) => setStage(index, e.target.value)
                })
              )
            ),
            h(
              'p',
              { className: 'poi-settings-note' },
              `阶段合计 ${draft.duration.toFixed(2)} 秒。保存范围为 6–15 秒。`
            ),
            h(
              'button',
              { onClick: () => reset('advanced'), disabled: busy },
              '恢复高级默认'
            )
          )
        ),
        message,
        h(
          'div',
          { className: 'poi-settings-actions' },
          h('button', { onClick: save, disabled: busy || !dirty }, '保存'),
          h('button', { onClick: preview, disabled: busy }, '预览已保存配置'),
          h(
            'button',
            {
              onClick: () => {
                setDraft(copy(saved))
                setError('')
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
          {
            name: 'settings.section',
            id: 'startup-screen',
            order: 26,
            label: 'POI 启动动画'
          },
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
