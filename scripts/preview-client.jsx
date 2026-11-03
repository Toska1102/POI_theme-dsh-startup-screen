import React from 'react'
import { createRoot } from 'react-dom/client'
window.__ModuleLoader__ = {
  load(entry) {
    const plugin = entry.factory(name => {
      if (name === 'react') return React
      throw new Error('Unexpected preview import: ' + name)
    })
    plugin.apply({
      slots: {
        inject(name, fn) {
          fn()
        },
        register(options, render) {
          createRoot(document.getElementById('settings')).render(render())
          return () => {}
        }
      }
    })
  }
}
const script = document.createElement('script')
script.src = '/preview-client.js'
document.head.append(script)
