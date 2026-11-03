/* Terminal stages: 00–04 and 08–09. */
;(() => {
  window.__POI_VIEWS__ = window.__POI_VIEWS__ || {}
  window.__POI_VIEWS__.terminal = ({
    element,
    config,
    reduced,
    animate,
    assetBase
  }) => {
    element.innerHTML = `<div class="poi-terminal-feed" hidden></div><div class="poi-terminal-scan" hidden></div>
      <div class="poi-stage-canvas">
        <div class="poi-terminal-fragments" aria-hidden="true"></div>
        <section class="poi-boot-terminal" hidden>
          <p class="poi-terminal-eyebrow">SURVEILLANCE TERMINAL / COLD START</p><h1>THE MACHINE</h1>
          <p class="poi-boot-command">&gt; BOOT SURVEILLANCE NETWORK_</p>
          <div class="poi-boot-logs"><div>CORE .......... ONLINE</div><div>MEMORY ........ MOUNTED</div><div>FEED BUS ...... CONNECTING</div></div>
          <i class="poi-terminal-cursor"></i>
        </section>
        <section class="poi-init-terminal" hidden><h2>INITIALIZING SYSTEM</h2><div class="poi-init-logs">
          <div>CORE ANALYTICS .......... ONLINE</div><div>NEURAL NETWORKS ......... ONLINE</div>
          <div>ENCRYPTION .............. ACTIVE</div><div>RETRIEVAL ENGINE ........ STANDBY</div></div>
          <p>SYSTEM SELF-CHECK / ALL MODULES READY</p>
        </section>
        <section class="poi-status-card" hidden><h2></h2><div><h3></h3><p></p></div></section>
        <section class="poi-operator-card" hidden><h2>OPERATOR IDENTIFIED</h2>
          <div class="poi-operator-details"><div class="poi-operator-photo"></div><div><h3></h3><p class="poi-operator-id"></p><p class="poi-operator-clearance"></p></div></div>
          <p class="poi-operator-admin">ADMIN / CONFIRMED</p>
        </section>
        <section class="poi-response" hidden><h2></h2><i class="poi-response-rule"></i><i class="poi-response-arrow" hidden></i></section>
      </div>
      <div class="poi-terminal-source" hidden><span>CAM NYPD-2703 / AERIAL FEED</span><time>21:00:28</time></div>
      <p class="poi-terminal-link" hidden>SOURCE LINK ESTABLISHED / PREPARING SYSTEM</p>`
    const q = (selector) => element.querySelector(selector)
    const boot = q('.poi-boot-terminal')
    const init = q('.poi-init-terminal')
    const status = q('.poi-status-card')
    const operator = q('.poi-operator-card')
    const response = q('.poi-response')
    const fragments = q('.poi-terminal-fragments')
    const feed = q('.poi-terminal-feed')
    const scan = q('.poi-terminal-scan')
    const active = new Set()
    const intensity = Math.max(
      0,
      Math.min(1, Number(config.effectIntensity) || 0)
    )
    feed.style.backgroundImage = `url("${assetBase}camera-a.png")`
    q('.poi-operator-photo').style.backgroundImage =
      `url("${assetBase}camera-b.png")`
    operator.querySelector('h3').textContent = String(
      config.identity || 'JOYCE MOORE'
    )
    q('.poi-operator-id').textContent =
      'IDENTITY / ' + String(config.identityId || '0087')
    q('.poi-operator-clearance').textContent =
      'CLEARANCE / ' + String(config.accessLevel || '3')
    const fragmentLayout = [
      [130, 160, 36, 2],
      [370, 210, 62, 5],
      [560, 440, 60, 3],
      [950, 700, 84, 5],
      [1325, 370, 108, 2],
      [1750, 650, 134, 3],
      [1850, 260, 134, 2],
      [2280, 550, 36, 3],
      [465, 825, 60, 3],
      [900, 1090, 84, 6],
      [1420, 985, 108, 3],
      [2190, 930, 36, 6]
    ]
    for (const [column, values] of fragmentLayout.entries()) {
      const [x, y, width, count] = values
      const track = document.createElement('div')
      track.className = 'poi-terminal-fragment-track'
      Object.assign(track.style, {
        left: x + 'px',
        top: y + 'px',
        width: width + 'px'
      })
      for (let row = 0; row < count; row++) {
        const frame = document.createElement('i')
        frame.style.backgroundImage = `url("${assetBase}camera-${['d', 'a', 'b', 'c'][(column + row) % 4]}.png")`
        track.append(frame)
      }
      fragments.append(track)
    }
    function clear() {
      active.forEach((animation) => animation.cancel())
      active.clear()
    }
    function motion(node, frames, options) {
      const animation = animate(node, frames, options)
      active.add(animation)
      return animation
    }
    function reveal(node, duration, distance = 8) {
      motion(
        node,
        [
          {
            opacity: 0,
            transform: reduced
              ? 'none'
              : `translateY(${distance * intensity}px)`
          },
          { opacity: 1, transform: 'none' }
        ],
        {
          duration: Math.min(160, duration * 0.2),
          fill: 'both',
          easing: 'ease-out'
        }
      )
    }
    function logRows(selector, duration) {
      q(selector)
        .querySelectorAll(':scope > div')
        .forEach((row, order) => {
          motion(row, [{ opacity: 0 }, { opacity: 1 }], {
            delay: duration * (0.08 + order * 0.18),
            duration: Math.min(100, duration * 0.1),
            fill: 'both'
          })
        })
    }
    let previousIndex = null
    return {
      render({ index, duration }) {
        const continuedFragments = previousIndex >= 2 && previousIndex <= 4
        const fragmentTransform = getComputedStyle(fragments).transform
        previousIndex = index
        clear()
        element.dataset.stage = String(index)
        boot.hidden = index !== 0
        init.hidden = index !== 2
        status.hidden = index !== 1 && index !== 3
        operator.hidden = index !== 4
        response.hidden = index !== 8 && index !== 9
        fragments.hidden = index < 2 || index > 4
        feed.hidden = index !== 1
        scan.hidden = index !== 1 || reduced || intensity === 0
        q('.poi-terminal-source').hidden = index !== 1
        q('.poi-terminal-link').hidden = index !== 1
        if (index === 0) {
          reveal(boot, duration)
          logRows('.poi-boot-logs', duration)
        } else if (index === 1) {
          status.querySelector('h2').textContent = 'CAMERA ACCESSED'
          status.querySelector('h3').textContent = 'SIGNAL ACQUIRED'
          status.querySelector('p').textContent =
            'FEED HANDSHAKE / INITIALIZING'
          reveal(status, duration)
          if (config.cameraMotion !== false && !reduced && intensity > 0)
            motion(
              feed,
              [
                { transform: 'scale(1)' },
                { transform: `scale(${1 + 0.018 * intensity})` }
              ],
              { duration, fill: 'both', easing: 'linear' }
            )
          motion(feed, [{ opacity: 0 }, { opacity: 0.11 }], {
            duration: Math.min(220, duration * 0.35),
            fill: 'both'
          })
          if (!scan.hidden)
            motion(
              scan,
              [
                { transform: 'translateY(15vh)' },
                { transform: 'translateY(80vh)' }
              ],
              { duration, fill: 'both', easing: 'linear' }
            )
        } else if (index === 2 || index === 3 || index === 4) {
          if (index === 2) {
            reveal(init, duration)
            logRows('.poi-init-logs', duration)
          } else if (index === 3) {
            status.querySelector('h2').textContent = 'ACCESS GATE'
            status.querySelector('h3').textContent = 'PERMISSION REQUIRED'
            status.querySelector('p').textContent = 'AWAITING OPERATOR CONSENT'
            reveal(status, duration)
          } else reveal(operator, duration)
          if (!continuedFragments)
            motion(fragments, [{ opacity: 0 }, { opacity: 1 }], {
              duration: Math.min(180, duration * 0.3),
              fill: 'both'
            })
          if (!reduced && config.cameraMotion !== false && intensity > 0)
            motion(
              fragments,
              [
                {
                  transform: continuedFragments
                    ? fragmentTransform
                    : 'translateY(0)'
                },
                { transform: `translateY(${-10 * (index - 1) * intensity}px)` }
              ],
              { duration, fill: 'both', easing: 'linear' }
            )
        } else if (index === 8 || index === 9) {
          response.querySelector('h2').textContent =
            index === 8
              ? 'CALCULATING RESPONSE'
              : String(config.terminalText || 'what are your commands？')
          q('.poi-response-arrow').hidden = index !== 9
          reveal(response, duration, 3)
          if (index === 8 && !reduced && intensity > 0)
            motion(
              q('.poi-response-rule'),
              [
                { transform: 'scaleX(.45)', opacity: 0.45 },
                { transform: 'scaleX(1)', opacity: 1 }
              ],
              {
                duration: Math.min(500, duration * 0.75),
                fill: 'both',
                easing: 'ease-out'
              }
            )
          if (index === 9) reveal(q('.poi-response-arrow'), duration, 6)
        }
      },
      dispose() {
        clear()
        element.replaceChildren()
      }
    }
  }
})()
