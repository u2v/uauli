import { Uau } from '@uau/core/src'

import uauConfig from './config'

const uauInstance = new Uau(uauConfig.uauSettings, uauConfig.storage)

addEventListener('fetch', (event) => {
  try {
    event.respondWith(uauInstance.handleRequest(event.request))
  } catch (e) {
    console.log('ERRR', String(e), event.request)
  }
})
