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
    const titles = {
      0: 'THE MACHINE',
      1: 'CAMERA ACCESSED',
      2: 'INITIALIZING SYSTEM',
      3: 'ACCESS PERMISSION REQUIRED',
      4: 'OPERATOR IDENTIFIED',
      8: 'CALCULATING RESPONSE'
    }
    element.innerHTML =
      '<div class="poi-terminal-surface"><h1></h1><p></p><pre></pre></div>'
    const title = element.querySelector('h1'),
      sub = element.querySelector('p'),
      data = element.querySelector('pre')
    let entrance
    return {
      render({ index, duration }) {
        entrance?.cancel()
        element.dataset.stage = String(index)
        element.style.backgroundImage =
          index === 1
            ? `linear-gradient(#02060988,#020609ee),url("${assetBase}camera-a.png")`
            : ''
        title.textContent =
          index === 9
            ? String(config.terminalText || 'what are your commands？')
            : titles[index]
        sub.textContent =
          index === 3
            ? 'AWAITING OPERATOR CONSENT'
            : index === 4
              ? String(config.identity || 'JOYCE MOORE')
              : ''
        data.textContent =
          index === 0
            ? '> BOOT SURVEILLANCE NETWORK_\nCORE .......... ONLINE\nMEMORY ........ MOUNTED\nFEED BUS ...... CONNECTING'
            : index === 2
              ? 'CORE ANALYTICS .......... ONLINE\nNEURAL NETWORKS ......... ONLINE\nENCRYPTION .............. ACTIVE\nRETRIEVAL ENGINE ........ STANDBY'
              : index === 4
                ? `IDENTITY / ${config.identityId || '0087'}\nCLEARANCE / ${config.accessLevel || '3'}\nADMIN / CONFIRMED`
                : ''
        entrance = animate(
          element.querySelector('.poi-terminal-surface'),
          [
            { opacity: 0, transform: reduced ? 'none' : 'translateY(8px)' },
            { opacity: 1, transform: 'none' }
          ],
          { duration: Math.min(200, duration * 0.25), fill: 'both' }
        )
      },
      dispose() {
        entrance?.cancel()
        element.replaceChildren()
      }
    }
  }
})()
