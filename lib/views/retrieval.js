/* Retrieval stages: 05–07. */
;(() => {
  window.__POI_VIEWS__ = window.__POI_VIEWS__ || {}
  window.__POI_VIEWS__.retrieval = ({
    element,
    config,
    reduced,
    signal,
    animate,
    assetBase
  }) => {
    const times = [
      '21:00:12',
      '21:00:20',
      '21:00:28',
      '21:00:36',
      '21:00:44',
      '21:00:52',
      '21:01:00'
    ]
    const positions = [
      80, 210, 410, 630, 700, 890, 1040, 1260, 1450, 1560, 1760, 1850, 2100,
      2210, 2350, 2480
    ]
    const cameras = ['b', 'a', 'c', 'd']
    const motions = new Set()
    let lineFrame = null
    let selectedImage = null
    let sourceMarker = null
    element.classList.add('poi-retrieval')
    element.innerHTML = `<div class="poi-stage-canvas poi-retrieval-canvas"><div class="poi-timelines"></div><div class="poi-retrieval-scan"></div><div class="poi-source-connection" role="img" aria-label="CAM 03 source connection" hidden></div><div class="poi-source-connection poi-source-connection-secondary" role="img" aria-label="CAM 14 source connection" hidden></div><section class="poi-selected-camera" aria-label="Selected surveillance keyframe" hidden><header>CAM 03 / FRAME 002 / 21:00:28</header><div class="poi-selected-image"><div class="poi-entity-track poi-entity-one" role="group" aria-label="ENTITY 001 track"><span>ENTITY 001</span><i></i><i></i><i></i><i></i></div><div class="poi-entity-track poi-entity-two" role="group" aria-label="ENTITY 002 track" hidden><span>ENTITY 002</span><i></i><i></i><i></i><i></i></div></div><footer></footer></section><section class="poi-retrieval-status"><h2></h2><p></p><small></small></section><p class="poi-retrieval-task"></p></div>`
    const canvas = element.querySelector('.poi-retrieval-canvas')
    const tracks = element.querySelector('.poi-timelines')
    const lanes = []
    for (let laneIndex = 0; laneIndex < 16; laneIndex++) {
      const camera = String(laneIndex + 1).padStart(2, '0')
      const lane = document.createElement('section')
      lane.className = 'poi-timeline'
      lane.setAttribute('role', 'group')
      lane.setAttribute('aria-label', `CAM ${camera} timeline`)
      lane.style.left = positions[laneIndex] + 'px'
      lane.style.top = 110 + ((laneIndex * 97) % 250) + 'px'
      lane.style.setProperty(
        '--poi-thumb',
        (laneIndex === 2
          ? 146
          : laneIndex === 13
            ? 95
            : 45 + ((laneIndex * 23) % 54)) + 'px'
      )
      const label = document.createElement('h3')
      label.textContent = `CAM ${camera}`
      lane.append(label)
      times.forEach((time, frameIndex) => {
        const tile = document.createElement('figure')
        tile.className = 'poi-keyframe'
        tile.dataset.camera = camera
        tile.dataset.frame = String(frameIndex).padStart(3, '0')
        tile.style.top = 52 + frameIndex * 130 + 'px'
        const timestamp = document.createElement('time')
        timestamp.textContent = time
        const image = document.createElement('img')
        const hit =
          (laneIndex === 2 && frameIndex === 2) ||
          (laneIndex === 13 && frameIndex === 3)
        image.addEventListener(
          'error',
          () => {
            image.hidden = true
          },
          { once: true, signal }
        )
        image.src =
          assetBase +
          `camera-${hit || laneIndex === 2 ? 'c' : cameras[(laneIndex + frameIndex) % cameras.length]}.png`
        image.alt = `CAM ${camera} / FRAME ${tile.dataset.frame} / ${time}`
        image.draggable = false
        tile.append(timestamp, image)
        if (hit) {
          tile.classList.add('poi-keyframe-match')
          const match = document.createElement('figcaption')
          match.textContent = 'MATCH'
          tile.append(match)
        }
        lane.append(tile)
      })
      tracks.append(lane)
      lanes.push(lane)
    }
    const scan = element.querySelector('.poi-retrieval-scan')
    const heading = element.querySelector('.poi-retrieval-status h2')
    const status = element.querySelector('.poi-retrieval-status p')
    const detail = element.querySelector('.poi-retrieval-status small')
    const task = element.querySelector('.poi-retrieval-task')
    function move(node, frames, options) {
      const animation = animate(node, frames, options)
      motions.add(animation)
      return animation
    }
    const selected = element.querySelector('.poi-selected-camera')
    const selectedPicture = element.querySelector('.poi-selected-image')
    const selectedStatus = selected.querySelector('footer')
    const entityOne = selected.querySelector('.poi-entity-one')
    const entityTwo = selected.querySelector('.poi-entity-two')
    const connections = [...element.querySelectorAll('.poi-source-connection')]
    const sourceTile = tracks.querySelector(
      '[data-camera="03"][data-frame="002"]'
    )
    const secondSource = tracks.querySelector(
      '[data-camera="14"][data-frame="003"] img'
    )
    function sceneRect(node) {
      const box = node.getBoundingClientRect()
      const scene = canvas.getBoundingClientRect()
      const scale = scene.width / 2560
      return {
        x: (box.x - scene.x) / scale,
        y: (box.y - scene.y) / scale,
        width: box.width / scale,
        height: box.height / scale
      }
    }
    function updateConnections() {
      if (!sourceMarker || !selectedImage) return
      if (sourceMarker.hidden || selectedImage.hidden) {
        connections.forEach((line) => {
          line.hidden = true
        })
        return
      }
      const target = sceneRect(selected)
      const sources = [sceneRect(sourceMarker), sceneRect(secondSource)]
      const geometry = sources.map((source, i) => {
        const x = i === 0 ? source.x + source.width : source.x
        const y = source.y + source.height / 2
        const endX = i === 0 ? target.x : target.x + target.width
        const endY = Math.max(
          target.y + 52,
          Math.min(target.y + target.height - 40, y)
        )
        const dx = endX - x,
          dy = endY - y
        return `translate(${x}px, ${y}px) rotate(${Math.atan2(dy, dx)}rad) scaleX(${Math.hypot(dx, dy)})`
      })
      connections.forEach((line, i) => {
        line.style.transform = geometry[i]
      })
    }
    function followConnections(duration) {
      const start = performance.now()
      const tick = () => {
        updateConnections()
        if (!signal.aborted && performance.now() - start < duration)
          lineFrame = requestAnimationFrame(tick)
        else lineFrame = null
      }
      tick()
    }
    function lock(track, delay, duration) {
      track.hidden = false
      track.style.opacity = '1'
      if (reduced) {
        move(track, [{ opacity: 0 }, { opacity: 1 }], {
          duration: Math.min(120, duration),
          fill: 'both'
        })
      } else {
        move(
          track,
          [
            { opacity: 0, transform: 'scale(1.08)' },
            { opacity: 1, transform: 'scale(1)' }
          ],
          { delay, duration, fill: 'both', easing: 'ease-out' }
        )
      }
    }
    function revealKeyframe(index, duration) {
      const sourceImage = sourceTile.querySelector('img')
      const previous = selected.hidden
        ? sceneRect(sourceImage.hidden ? sourceTile : sourceImage)
        : sceneRect(selected)
      if (!selectedImage) {
        selectedImage = sourceTile.querySelector('img')
        sourceMarker = selectedImage.cloneNode(true)
        sourceMarker.addEventListener(
          'error',
          () => {
            sourceMarker.hidden = true
          },
          { once: true, signal }
        )
        sourceMarker.alt = ''
        sourceMarker.setAttribute('aria-hidden', 'true')
        sourceTile.replaceChild(sourceMarker, selectedImage)
        selectedPicture.prepend(selectedImage)
      }
      const target =
        index === 6
          ? { x: 840, y: 380, width: 880 }
          : { x: 720, y: 280, width: 1120 }
      selected.style.left = target.x + 'px'
      selected.style.top = target.y + 'px'
      selected.style.width = target.width + 'px'
      selected.hidden = false
      selectedStatus.textContent =
        index === 6
          ? 'KEYFRAME SELECTED / TRACK ACQUIRED'
          : '2 ENTITIES LOCKED / TEMPORAL MATCH'
      const zoom = !reduced && config.cameraMotion !== false
      const flight = Math.min(
        duration * 0.78,
        (duration * 0.62) / (Number(config.scanSpeed) || 1)
      )
      if (zoom) {
        const scale = previous.width / target.width
        const dy = previous.y - target.y - (index === 6 ? 52 * scale : 0)
        move(
          selected,
          [
            {
              transform: `translate(${previous.x - target.x}px, ${dy}px) scale(${scale})`,
              opacity: index === 6 ? 0.25 : 1
            },
            { transform: 'translate(0, 0) scale(1)', opacity: 1 }
          ],
          {
            duration: flight,
            easing: 'cubic-bezier(.22,.65,.2,1)',
            fill: 'both'
          }
        )
      } else {
        move(selected, [{ opacity: 0.25 }, { opacity: 1 }], {
          duration: Math.min(160, duration * 0.2),
          fill: 'both'
        })
      }
      const lockTime = Math.min(
        duration * 0.23,
        240 / (Number(config.lockSpeed) || 1)
      )
      if (index === 6) {
        entityTwo.hidden = true
        lock(entityOne, zoom ? flight * 0.8 : 0, lockTime)
      } else {
        entityOne.style.opacity = '1'
        entityOne.style.transform = 'none'
        lock(entityTwo, zoom ? flight * 0.25 : 0, lockTime)
      }
      connections.forEach((line) => {
        line.hidden = false
      })
      followConnections(zoom ? flight : 180)
    }
    function stop() {
      if (lineFrame != null) cancelAnimationFrame(lineFrame)
      lineFrame = null
      motions.forEach((animation) => {
        try {
          animation.commitStyles()
        } catch {}
        animation.cancel()
      })
      motions.clear()
    }
    signal.addEventListener('abort', stop, { once: true })
    return {
      render({ index, duration }) {
        stop()
        element.dataset.stage = String(index)
        canvas.style.setProperty(
          '--poi-retrieval-effect',
          Number(config.effectIntensity ?? 0.55)
        )
        heading.textContent =
          index === 5 ? 'RETRIEVAL INITIALIZING' : 'TOTAL ACCESS ACHIEVED'
        status.textContent = [
          'BUILDING SOURCE INDEX',
          'KEYFRAMES LOCATED',
          'ENTITIES LOCKED'
        ][index - 5]
        detail.textContent = [
          'VIDEO / ARCHIVE / DOCUMENTS',
          'TEMPORAL MATCH / SELECTING FRAME_',
          '2 TRACKS / ASSIMILATING DATA_'
        ][index - 5]
        task.textContent = `REQUEST ${config.identityId || '0087'} / CONNECTING AUTHORIZED SOURCES`
        task.hidden = index !== 5
        scan.hidden = reduced || index !== 5
        if (index === 6 || index === 7) revealKeyframe(index, duration)
        if (index === 5 && !reduced) {
          const speed = Number(config.scanSpeed) || 1
          lanes.forEach((lane, i) =>
            move(
              lane,
              [
                { transform: 'translateY(0)' },
                {
                  transform: `translateY(${-140 * speed * (1 + (i % 3) * 0.12)}px)`
                }
              ],
              { duration, easing: 'linear', fill: 'forwards' }
            )
          )
          move(scan, [{ top: '180px' }, { top: '1220px' }], {
            duration: duration / speed,
            iterations: Infinity,
            easing: 'linear'
          })
        }
      },
      dispose() {
        stop()
        element.replaceChildren()
      }
    }
  }
})()
