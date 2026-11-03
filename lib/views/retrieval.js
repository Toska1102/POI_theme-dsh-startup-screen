/* Retrieval stages: 05–07. */
;(() => {
  window.__POI_VIEWS__ = window.__POI_VIEWS__ || {}
  window.__POI_VIEWS__.retrieval = ({
    element,
    config,
    reduced,
    animate,
    assetBase
  }) => {
    element.innerHTML = `<div class="poi-retrieval-image"></div><section class="poi-retrieval-status"><h2></h2><p></p></section>`
    element.querySelector('.poi-retrieval-image').style.backgroundImage =
      `url("${assetBase}camera-c.png")`
    let motion
    return {
      render({ index, duration }) {
        element.dataset.stage = String(index)
        element.querySelector('h2').textContent = [
          'RETRIEVAL INITIALIZING',
          'KEYFRAMES LOCATED',
          'ENTITIES LOCKED'
        ][index - 5]
        element.querySelector('p').textContent =
          `REQUEST ${config.identityId || '0087'} / AUTHORIZED SOURCES`
        motion?.cancel()
        if (!reduced && config.cameraMotion !== false)
          motion = animate(
            element.querySelector('.poi-retrieval-image'),
            [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }],
            { duration, fill: 'forwards' }
          )
      },
      dispose() {
        motion?.cancel()
        element.replaceChildren()
      }
    }
  }
})()
