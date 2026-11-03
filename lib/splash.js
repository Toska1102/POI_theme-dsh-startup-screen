/* POI startup coordinator. The Host serves view scripts before this classic script. */
;(() => {
  'use strict'
  const ROOT = 'dsh-startup-root'
  const BASE = '/dsh-startup/asset/'
  const DEFAULT_DURATIONS = [0.8, 0.7, 0.8, 0.5, 0.6, 0.9, 1.7, 1.5, 0.8, 0.7]
  const CODES = [
    'INIT',
    'CONNECT',
    'SELF-CHECK',
    'CONSENT',
    'IDENTITY',
    'RETRIEVAL',
    'KEYFRAME',
    'LOCK',
    'CALCULATE',
    'HANDOFF'
  ]
  window.__DSH_STARTUP_API__?.dispose?.()
  let current = null
  const api = {
    config: window.__DSH_STARTUP__ || {},
    replay(config) {
      current?.dispose()
      api.config = { ...api.config, ...(config || {}) }
      window.__DSH_STARTUP__ = { ...api.config }
      window.__DSH_STARTUP_SKIP__ = false
      current = createRun(api.config)
      return current.ready
    },
    skip() {
      if (api.config.allowSkip !== false) current?.finish('skip')
    },
    finish() {
      current?.finish('complete')
    },
    dispose() {
      current?.dispose()
      current = null
    }
  }
  window.__DSH_STARTUP_API__ = api
  window.__DSH_STARTUP_LOADED__ = true
  if (window.__DSH_STARTUP_SKIP__ || api.config.enabled === false) {
    document.getElementById(ROOT)?.remove()
    document.documentElement.classList.remove('dsu-lock')
    return
  }
  api.replay()

  function createRun(config) {
    const controller = new AbortController()
    const { signal } = controller
    const timers = new Set(),
      listeners = [],
      animations = new Set()
    let ended = false,
      accept = null,
      watchdog = null
    const reduced =
      config.reducedMotion === 'reduce' ||
      (config.reducedMotion !== 'full' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const durations =
      Array.isArray(config.stageDurations) &&
      config.stageDurations.length === 10
        ? config.stageDurations.map(
            (value, index) =>
              Math.max(0.001, Number(value) || DEFAULT_DURATIONS[index]) * 1000
          )
        : DEFAULT_DURATIONS.map(
            (value) => ((value * (Number(config.duration) || 9)) / 9) * 1000
          )
    const root = document.getElementById(ROOT) || document.createElement('div')
    root.id = ROOT
    root.className = 'poi-root'
    root.dataset.platform = /Mac/.test(navigator.platform) ? 'mac' : 'other'
    root.dataset.reducedMotion = String(reduced)
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'true')
    root.setAttribute('aria-label', 'The Machine 启动序列')
    root.tabIndex = -1
    root.innerHTML = `<header class="poi-header"><span>THE MACHINE / DEEPSEEK HARNESS</span><span class="poi-counter"></span></header>
      <section class="poi-terminal-view"></section><section class="poi-retrieval-view" hidden></section>
      <div class="poi-actions" hidden><button type="button" class="poi-confirm">GRANT ACCESS</button><p>CLICK / ENTER / SPACE TO CONTINUE</p></div>
      <footer class="poi-footer"><span>NODE 0001 / SESSION <b class="poi-session"></b></span><button type="button" class="poi-skip">SKIP ▸</button></footer>`
    if (!root.isConnected) document.body.append(root)
    const q = (selector) => root.querySelector(selector)
    const previousFocus = document.activeElement
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.classList.add('dsu-lock')
    root.focus({ preventScroll: true })
    root.style.setProperty(
      '--poi-effect',
      Math.max(0, Math.min(1, Number(config.effectIntensity) || 0))
    )
    q('.poi-session').textContent = String(config.identityId || '0087')
    q('.poi-skip').hidden = config.allowSkip === false
    window.__DSH_STARTUP_RUNNING__ = true
    window.__DSH_STARTUP_FINISHED__ = false
    const sound = createSound(config, signal, on, timer)
    const views = Object.fromEntries(
      ['terminal', 'retrieval'].map((name) => {
        const create = window.__POI_VIEWS__?.[name]
        if (typeof create !== 'function')
          throw new Error('Missing POI view: ' + name)
        return [
          name,
          create({
            element: q('.poi-' + name + '-view'),
            root,
            config,
            reduced,
            signal,
            animate,
            assetBase: BASE
          })
        ]
      })
    )
    on(q('.poi-skip'), 'click', () => finish('skip'))
    on(q('.poi-confirm'), 'click', () => accept?.())
    on(
      document,
      'keydown',
      (event) => {
        if (event.key === 'Escape' && config.allowSkip !== false) {
          event.preventDefault()
          event.stopImmediatePropagation()
          finish('skip')
        } else if (
          accept &&
          !event.repeat &&
          ['Enter', ' '].includes(event.key)
        ) {
          event.preventDefault()
          event.stopImmediatePropagation()
          accept()
        }
      },
      true
    )
    on(window, 'resize', layout)
    function on(target, name, handler, options) {
      target.addEventListener(name, handler, options)
      listeners.push(() => target.removeEventListener(name, handler, options))
    }
    function timer(fn, ms) {
      const handle = setTimeout(() => {
        timers.delete(handle)
        if (!ended) fn()
      }, ms)
      timers.add(handle)
      return handle
    }
    function delay(ms) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason)
        const abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        timer(() => {
          signal.removeEventListener('abort', abort)
          resolve()
        }, ms)
      })
    }
    function arm() {
      clearTimeout(watchdog)
      watchdog = timer(
        () => finish('timeout'),
        Math.max(20000, durations.reduce((a, b) => a + b, 0) * 2)
      )
    }
    function animate(node, keyframes, options) {
      const animation = node.animate(keyframes, options)
      animations.add(animation)
      return animation
    }
    function layout() {
      root.style.setProperty(
        '--poi-scale',
        Math.min(root.clientWidth / 2560, root.clientHeight / 1440)
      )
    }
    function render(index) {
      root.dataset.stage = String(index)
      q('.poi-counter').textContent =
        `${String(index + 1).padStart(2, '0')} / 10`
      const name = index >= 5 && index <= 7 ? 'retrieval' : 'terminal'
      q('.poi-terminal-view').hidden = name !== 'terminal'
      q('.poi-retrieval-view').hidden = name !== 'retrieval'
      q('.poi-actions').hidden = index !== 3
      views[name].render({ index, duration: durations[index] })
      sound.effect(index === 7 ? 'verified' : 'step')
      window.dispatchEvent(
        new CustomEvent('dsh-startup:stage', {
          detail: { index, code: CODES[index] }
        })
      )
    }
    function waitAction() {
      clearTimeout(watchdog)
      q('.poi-confirm').focus({ preventScroll: true })
      return new Promise((resolve) => {
        accept = () => {
          accept = null
          q('.poi-actions').hidden = true
          sound.effect('confirm')
          arm()
          resolve()
        }
        signal.addEventListener('abort', resolve, { once: true })
      })
    }
    function markShown() {
      try {
        if (config.mode === 'session')
          sessionStorage.setItem('poi-theme-dsh-startup-screen:shown', '1')
        if (config.mode === 'daily')
          localStorage.setItem(
            'poi-theme-dsh-startup-screen:day',
            new Date().toLocaleDateString('en-CA')
          )
      } catch {}
    }
    function cleanup() {
      controller.abort(new DOMException('Startup ended', 'AbortError'))
      timers.forEach(clearTimeout)
      timers.clear()
      listeners.forEach((remove) => remove())
      animations.forEach((animation) => animation.cancel())
      Object.values(views).forEach((view) => view.dispose?.())
      sound.dispose()
      accept = null
      root.remove()
      document.documentElement.style.overflow = previousOverflow
      document.documentElement.classList.remove('dsu-lock')
      window.__DSH_STARTUP_RUNNING__ = false
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true })
    }
    function dispose() {
      if (!ended) {
        ended = true
        cleanup()
      }
    }
    function finish(reason) {
      if (ended) return
      ended = true
      markShown()
      cleanup()
      window.__DSH_STARTUP_FINISHED__ = true
      if (reason === 'timeout') window.__DSH_STARTUP_STALLED__ = true
      window.dispatchEvent(
        new CustomEvent('dsh-startup:done', { detail: { reason } })
      )
    }
    async function run() {
      layout()
      try {
        for (const key of ['a', 'b', 'c', 'd']) {
          const image = new Image()
          image.src = BASE + 'camera-' + key + '.png'
          image.decode().catch(() => {})
        }
        for (let index = 0; index < 10; index++) {
          if (ended) return
          arm()
          render(index)
          if (index === 3) await waitAction()
          if (ended) return
          // Start the visual budget after manual authorization, never during its wait.
          if (index === 9)
            timer(
              () =>
                animate(root, [{ opacity: 1 }, { opacity: 0 }], {
                  duration: Math.min(200, durations[index]),
                  fill: 'forwards'
                }),
              Math.max(0, durations[index] - 200)
            )
          await Promise.all([
            delay(durations[index]),
            index >= 3 && index <= 8
              ? sound.voice(index - 2)
              : Promise.resolve()
          ])
        }
        finish('complete')
      } catch (error) {
        if (!signal.aborted) {
          console.warn('[POI startup]', error)
          finish('error')
        }
      }
    }
    const ready = Promise.resolve().then(run)
    return { ready, dispose, finish }
  }

  function createSound(config, signal, on, timer) {
    let context = null
    let unlocked = false
    let releaseUnlock
    const unlockedPromise = new Promise((resolve) => {
      releaseUnlock = resolve
    })
    const nodes = new Set()
    const buffers = new Map()
    const volume = Math.max(0, Math.min(1, Number(config.soundVolume) || 0))
    const voiceVolume = Math.max(
      0,
      Math.min(1, Number(config.voiceVolume) || 0)
    )
    function audioContext() {
      if (!context) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (AC) context = new AC()
      }
      return context
    }
    async function unlock() {
      if (unlocked) return
      unlocked = true
      try {
        await audioContext()?.resume()
      } catch {
        /* Continue silently. */
      }
      releaseUnlock()
    }
    on(document, 'pointerdown', unlock)
    on(document, 'keydown', unlock)
    signal.addEventListener('abort', releaseUnlock, { once: true })
    function load(number) {
      if (!buffers.has(number))
        buffers.set(
          number,
          (async () => {
            try {
              const response = await fetch(BASE + `line-${number}.mp3`, {
                signal
              })
              if (!response.ok) return null
              const bytes = await response.arrayBuffer()
              if (signal.aborted) return null
              return await audioContext()?.decodeAudioData(bytes)
            } catch {
              return null
            }
          })()
        )
      return buffers.get(number)
    }
    if (config.voice) for (let n = 1; n <= 6; n++) load(n)
    async function voice(number) {
      if (!config.voice || signal.aborted) return
      // The first confirmation unlocks human voice. Automatic mode stays silent until a gesture.
      if (!unlocked && config.requireInteraction !== false)
        await unlockedPromise
      if (!unlocked || signal.aborted) return
      const buffer = await load(number)
      if (!buffer || signal.aborted || !context || context.state !== 'running')
        return
      await new Promise((resolve) => {
        const source = context.createBufferSource(),
          gain = context.createGain()
        source.buffer = buffer
        gain.gain.value = voiceVolume
        source.connect(gain)
        gain.connect(context.destination)
        nodes.add(source)
        let settled = false
        const settle = () => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', abort)
          nodes.delete(source)
          source.disconnect()
          gain.disconnect()
          resolve()
        }
        const abort = () => {
          try {
            source.stop()
          } catch {}
          settle()
        }
        signal.addEventListener('abort', abort, { once: true })
        source.onended = settle
        source.start()
        timer(
          () => {
            if (nodes.has(source)) source.stop()
          },
          buffer.duration * 1000 + 1000
        )
      })
    }
    function effect(kind) {
      if (
        !config.sound ||
        !unlocked ||
        signal.aborted ||
        !context ||
        context.state !== 'running'
      )
        return
      const frequencies =
        kind === 'verified'
          ? [659, 831, 988]
          : kind === 'confirm'
            ? [660, 990]
            : [1600]
      frequencies.forEach((frequency, i) => {
        const source = context.createOscillator(),
          gain = context.createGain(),
          start = context.currentTime + i * 0.06
        source.frequency.value = frequency
        source.type = 'sine'
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.0001, volume * 0.08),
          start + 0.008
        )
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12)
        source.connect(gain)
        gain.connect(context.destination)
        nodes.add(source)
        source.onended = () => {
          nodes.delete(source)
          source.disconnect()
          gain.disconnect()
        }
        source.start(start)
        source.stop(start + 0.15)
      })
    }
    function dispose() {
      releaseUnlock()
      for (const source of nodes) {
        try {
          source.stop()
        } catch {
          /* Already stopped. */
        }
      }
      nodes.clear()
      context?.close().catch(() => {})
    }
    return { voice, effect, dispose }
  }
})()
