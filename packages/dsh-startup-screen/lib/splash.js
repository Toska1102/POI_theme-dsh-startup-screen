/* POI startup runtime. Classic script: runs in DSH and in the local preview. */
;(() => {
  'use strict'
  const ROOT = 'dsh-startup-root'
  const BASE = '/dsh-startup/asset/'
  const STAGES = [
    { code: 'INIT', title: 'THE MACHINE', sub: 'EVER THINK YOU ARE BEING WATCHED?', hold: 2500 },
    {
      code: 'CONNECT',
      camera: 'a',
      title: 'CAMERA ACCESSED',
      sub: 'SOURCE: NYPD / FEED HANDSHAKE ACTIVE',
      hold: 1200
    },
    {
      code: 'SELF-CHECK',
      camera: 'b',
      title: 'SYSTEM SELF-CHECK',
      sub: 'SCANNING FEED / ANALYTICS ONLINE',
      hold: 1500
    },
    {
      code: 'CONSENT',
      camera: 'b',
      title: 'ACCESS PERMISSION REQUIRED',
      sub: 'AWAITING OPERATOR CONSENT',
      action: 'GRANT ACCESS',
      voice: 1,
      hold: 700
    },
    {
      code: 'IDENTITY',
      camera: 'b',
      title: 'IDENTITY VERIFICATION',
      sub: 'MATCHING OPERATOR RECORD',
      action: 'CONFIRM IDENTITY',
      voice: 2,
      hold: 700
    },
    {
      code: 'REQUEST',
      camera: 'c',
      title: 'ACCESS REQUEST RECEIVED',
      sub: 'HANDSHAKE ESTABLISHED',
      voice: 3,
      hold: 1200
    },
    {
      code: 'READ',
      camera: 'c',
      title: 'PERMISSION READ STARTED',
      sub: 'READING PERMISSION SET',
      voice: 4,
      hold: 1500
    },
    {
      code: 'VERIFIED',
      camera: 'c',
      title: 'READ COMPLETE · VERIFIED',
      sub: 'PERMISSION AUTHORIZED',
      voice: 5,
      hold: 1700
    },
    {
      code: 'WELCOME',
      camera: 'd',
      title: 'WELCOME',
      sub: 'ACCESS GRANTED / ENTERING DEEPSEEK HARNESS.',
      voice: 6,
      hold: 2000
    },
    {
      code: 'HANDOFF',
      camera: 'd',
      title: 'DEEPSEEK HARNESS',
      sub: 'SESSION READY / HANDOFF COMPLETE',
      hold: 800
    }
  ]
  // Coordinates refer to the 2560 × 1440 design, including its cover-cropped images.
  const CAMERAS = {
    a: { label: 'CAM NYPD-2703', feed: 'AERIAL FEED / NYC-07', box: null },
    b: {
      label: 'CAM WASH-SQ-08',
      feed: 'STREET FEED / WASHINGTON SQUARE',
      box: [1405, 520, 256, 256]
    },
    c: {
      label: 'CAM CORRIDOR-03',
      feed: 'INTERIOR FEED / CORRIDOR-03',
      box: [1400, 505, 256, 256]
    },
    d: { label: 'CAM NYPD-AERIAL-08', feed: 'AERIAL FEED / NYC-08', box: [1177, 426, 185, 185] }
  }

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
    const timers = new Set()
    const listeners = []
    const animations = new Set()
    let ended = false
    let accept = null
    let watchdog = null
    let sceneAnimation = null
    let camera = null
    const speed = Math.min(3, Math.max(0.35, Number(config.speed) || 1))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.getElementById(ROOT) || document.createElement('div')
    root.id = ROOT
    root.className = 'poi-root'
    root.dataset.platform = /Mac/.test(navigator.platform) ? 'mac' : 'other'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'true')
    root.tabIndex = -1
    root.setAttribute('aria-label', 'The Machine 启动序列')
    root.innerHTML = `<div class="poi-scene"><div class="poi-optics"><div class="poi-photo"></div><div class="poi-grade"></div><div class="poi-target"><i></i><b></b><span></span></div><div class="poi-ring"></div></div></div>
      <div class="poi-vignette"></div><div class="poi-scanlines"></div><div class="poi-noise"></div>
      <header class="poi-header"><span class="poi-camera"></span><time></time></header>
      <section class="poi-boot"><small>NODE / 0001</small><h1>THE MACHINE</h1><p>EVER THINK YOU ARE BEING WATCHED?</p><div class="poi-terminal"></div><i></i></section>
      <aside class="poi-dossier"><h2>ADMIN IDENTIFIED</h2><div>ALIAS: <span class="poi-alias"></span></div><dl></dl></aside>
      <div class="poi-data"></div>
      <section class="poi-status" aria-live="polite"><h2></h2><p></p></section>
      <div class="poi-actions"><button class="poi-confirm" type="button"></button><p>CLICK / ENTER / SPACE TO CONTINUE</p></div>
      <section class="poi-welcome"><h2></h2><p></p></section>
      <footer><div class="poi-feed"></div><div class="poi-bottom"><span class="poi-counter"></span><button class="poi-skip" type="button">SKIP ▸</button></div><div class="poi-progress"><i></i></div></footer>
      <div class="poi-flash"></div><div class="poi-glitch"><i></i><i></i><i></i></div>`
    if (!root.isConnected) document.body.append(root)
    const q = s => root.querySelector(s)
    const previousFocus = document.activeElement
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.classList.add('dsu-lock')
    root.focus({ preventScroll: true })
    window.__DSH_STARTUP_RUNNING__ = true
    window.__DSH_STARTUP_FINISHED__ = false
    const sound = createSound(config, signal, on, timer)
    const name = String(config.identity || 'JOYCE MOORE').slice(0, 48)
    const id = String(config.identityId || '0087').slice(0, 16)
    const level = String(config.accessLevel || '3').slice(0, 16)
    q('.poi-alias').textContent = name
    for (const [label, value] of [
      ['IDENTITY', name],
      ['ID', id],
      ['CLEARANCE', 'LEVEL ' + level],
      ['FEED', CAMERAS.b.label]
    ]) {
      const dt = document.createElement('dt'),
        dd = document.createElement('dd')
      dt.textContent = label
      dd.textContent = value
      q('dl').append(dt, dd)
    }
    q('.poi-skip').hidden = config.allowSkip === false
    on(q('.poi-skip'), 'click', () => finish('skip'))
    on(q('.poi-confirm'), 'click', () => accept?.())
    on(document, 'keydown', event => {
      if (event.key === 'Escape' && config.allowSkip !== false) {
        event.preventDefault()
        finish('skip')
      }
      if (accept && !event.repeat && ['Enter', ' '].includes(event.key)) {
        event.preventDefault()
        accept()
      }
    })
    on(window, 'resize', layout)
    const clock = () => {
      q('time').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false })
    }
    clock()
    function tick() {
      if (ended) return
      clock()
      timer(tick, 1000)
    }
    timer(tick, 1000)

    function on(target, event, handler) {
      target.addEventListener(event, handler)
      listeners.push(() => target.removeEventListener(event, handler))
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
        if (signal.aborted) {
          reject(signal.reason)
          return
        }
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
      watchdog = timer(() => finish('timeout'), Math.max(15000, 12000 / speed))
    }
    function animate(node, frames, options) {
      const animation = node.animate(frames, options)
      animations.add(animation)
      return animation
    }
    function layout() {
      const scale = Math.max(root.clientWidth / 2560, root.clientHeight / 1440)
      const scene = q('.poi-scene')
      scene.style.width = '2560px'
      scene.style.height = '1440px'
      scene.style.transform = `translate(-50%, -50%) scale(${scale})`
      root.style.setProperty('--poi-ui', Math.max(0.65, Math.min(1.1, root.clientWidth / 2560)))
    }
    function setCamera(key) {
      if (camera === key) return
      camera = key
      sceneAnimation?.cancel()
      const scene = q('.poi-scene')
      scene.style.opacity = key ? '1' : '0'
      if (!key) return
      q('.poi-photo').style.backgroundImage = `url("${BASE}camera-${key}.png")`
      q('.poi-camera').textContent = CAMERAS[key].label
      const box = CAMERAS[key].box
      q('.poi-target').hidden = !box
      if (box) {
        const target = q('.poi-target')
        target.style.setProperty('--poi-target-width', box[2] + 'px')
        ;['left', 'top', 'width', 'height'].forEach((property, i) => {
          target.style[property] = box[i] + 'px'
        })
        const ring = q('.poi-ring')
        ring.style.left = box[0] + box[2] / 2 + 'px'
        ring.style.top = box[1] + box[3] / 2 + 'px'
      }
      if (!reduced) {
        // Image and HUD move together inside a second, uniformly scaled scene wrapper.
        sceneAnimation = animate(
          q('.poi-optics'),
          [{ transform: 'scale(1)' }, { transform: 'scale(1.012)' }],
          { duration: 8000 / speed, direction: 'alternate', iterations: Infinity }
        )
        animations.add(sceneAnimation)
      }
    }
    function render(index) {
      const stage = STAGES[index]
      root.dataset.stage = String(index)
      setCamera(stage.camera || null)
      if (stage.action && config.requireInteraction !== false) sceneAnimation?.pause()
      else sceneAnimation?.play()
      q('.poi-status h2').textContent = stage.title
      q('.poi-status p').textContent = stage.sub
      q('.poi-counter').textContent = `${String(index + 1).padStart(2, '0')} / 10  ·  ${stage.code}`
      q('.poi-progress i').style.width = (index + 1) * 10 + '%'
      q('.poi-feed').textContent = stage.camera
        ? `${CAMERAS[stage.camera].feed}  /  ${index > 4 ? 'IDENTITY: CONFIRMED' : 'SIGNAL: STABLE'}  /  ENCRYPTION: ACTIVE`
        : 'INITIALIZING SURVEILLANCE NETWORK'
      q('.poi-target span').textContent =
        index < 4 ? 'OPERATOR' : index >= 8 ? 'CURRENT CAMERA' : 'ADMIN'
      q('.poi-target').classList.toggle('poi-identified', index >= 4)
      q('.poi-confirm').textContent = stage.action || ''
      q('.poi-actions').hidden = !stage.action || config.requireInteraction === false
      q('.poi-dossier').hidden = index !== 4
      q('.poi-status').hidden = index === 0 || index >= 8
      q('.poi-welcome').hidden = index < 8
      q('.poi-welcome h2').textContent = index === 8 ? `WELCOME, ${name}.` : stage.title
      q('.poi-welcome h2').dataset.text = q('.poi-welcome h2').textContent
      q('.poi-welcome p').textContent = stage.sub
      const data =
        index === 2
          ? 'CORE ANALYTICS [OK]  /  SUBJECT MATCH [PENDING]  /  ENCRYPTION [ACTIVE]'
          : index === 5
            ? `REQUEST ID / ${id}\nCONNECTING / SESSION ESTABLISHED / REQUEST RECEIVED`
            : index === 6
              ? `PERMISSION SET / LEVEL ${level}\nREADING PERMISSION SET\nUSER: ${name}\nWORKSPACE INDEX: 84%\nSESSION KEY: MATCHED`
              : index === 7
                ? 'AUTHORIZATION / VERIFIED\nREAD COMPLETE / IDENTITY VERIFIED / ACCESS GRANTED'
                : ''
      q('.poi-data').textContent = data
      if (index === 1 && !reduced)
        animate(q('.poi-flash'), [{ opacity: 0.7 }, { opacity: 0 }], { duration: 350 / speed })
      sound.effect(index === 7 ? 'verified' : 'step')
      window.dispatchEvent(
        new CustomEvent('dsh-startup:stage', { detail: { index, code: stage.code } })
      )
    }
    function waitAction() {
      if (config.requireInteraction === false) return Promise.resolve()
      clearTimeout(watchdog)
      q('.poi-confirm').focus({ preventScroll: true })
      return new Promise(resolve => {
        accept = () => {
          if (!accept) return
          accept = null
          q('.poi-actions').hidden = true
          sound.effect('confirm')
          arm()
          resolve()
        }
      })
    }
    function markShown() {
      try {
        if (config.mode === 'session') sessionStorage.setItem('dsh-startup-screen:shown', '1')
        if (config.mode === 'daily')
          localStorage.setItem('dsh-startup-screen:day', new Date().toLocaleDateString('en-CA'))
      } catch {
        /* Storage may be unavailable. */
      }
    }
    function cleanup() {
      controller.abort(new DOMException('Startup ended', 'AbortError'))
      timers.forEach(clearTimeout)
      timers.clear()
      listeners.forEach(remove => remove())
      animations.forEach(animation => animation.cancel())
      sound.dispose()
      accept = null
      root.remove()
      document.documentElement.style.overflow = previousOverflow
      document.documentElement.classList.remove('dsu-lock')
      window.__DSH_STARTUP_RUNNING__ = false
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
    function dispose() {
      if (ended) return
      ended = true
      cleanup()
    }
    function finish(reason) {
      if (ended) return
      ended = true
      markShown()
      cleanup()
      window.__DSH_STARTUP_FINISHED__ = true
      if (reason === 'timeout') window.__DSH_STARTUP_STALLED__ = true
      window.dispatchEvent(new CustomEvent('dsh-startup:done', { detail: { reason } }))
    }
    async function run() {
      layout()
      arm()
      try {
        // Render the black opening immediately. Camera failures retain the dark fallback.
        for (const key of Object.keys(CAMERAS)) {
          const image = new Image()
          image.src = BASE + 'camera-' + key + '.png'
          image.decode().catch(() => {})
        }
        await Promise.race([document.fonts.ready, delay(1500)])
        for (let index = 0; index < STAGES.length; index++) {
          if (ended) return
          arm()
          render(index)
          const stage = STAGES[index]
          if (index === 0) {
            for (const line of [
              'INIT................................OK',
              'RUNLEVEL.............................3',
              'CORE ANALYTICS......................OK',
              'NEURAL NETWORKS.....................OK',
              'LAUNCHING...'
            ]) {
              const row = document.createElement('div')
              row.textContent = line
              q('.poi-terminal').append(row)
              await delay(stage.hold / 5 / speed)
            }
          } else {
            await Promise.all([
              delay(stage.hold / speed),
              stage.voice ? sound.voice(stage.voice) : Promise.resolve(),
              stage.action ? waitAction() : Promise.resolve()
            ])
          }
        }
        if (!reduced) {
          root.classList.add('poi-leaving')
          await delay(300 / speed)
        }
        finish('complete')
      } catch (error) {
        if (!signal.aborted) {
          console.warn('[POI startup]', error)
          finish('error')
        }
      }
    }
    // Start in a microtask so current points to this instance before its first stage event.
    const ready = Promise.resolve().then(run)
    return { ready, dispose, finish }
  }

  function createSound(config, signal, on, timer) {
    let context = null
    let unlocked = false
    let releaseUnlock
    const unlockedPromise = new Promise(resolve => {
      releaseUnlock = resolve
    })
    const nodes = new Set()
    const buffers = new Map()
    const volume = Math.max(0, Math.min(1, Number(config.soundVolume) || 0))
    const voiceVolume = Math.max(0, Math.min(1, Number(config.voiceVolume) || 0))
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
              const response = await fetch(BASE + `line-${number}.mp3`, { signal })
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
      if (!unlocked && config.requireInteraction !== false) await unlockedPromise
      if (!unlocked || signal.aborted) return
      const buffer = await load(number)
      if (!buffer || signal.aborted || !context || context.state !== 'running') return
      await new Promise(resolve => {
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
      if (!config.sound || !unlocked || signal.aborted || !context || context.state !== 'running')
        return
      const frequencies =
        kind === 'verified' ? [659, 831, 988] : kind === 'confirm' ? [660, 990] : [1600]
      frequencies.forEach((frequency, i) => {
        const source = context.createOscillator(),
          gain = context.createGain(),
          start = context.currentTime + i * 0.06
        source.frequency.value = frequency
        source.type = 'sine'
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.08), start + 0.008)
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
