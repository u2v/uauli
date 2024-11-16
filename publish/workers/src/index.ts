import { Uau } from '@uau/core/src'

import uauConfig from './config'
import { WorkersKVDB } from './interface'

export default {
  async fetch(
    request: Request,
    env: {
      KV: KVNamespace
    },
    ctx: {
      waitUntil: (x: Promise<unknown>) => void
    }
  ) {
    const uauInstance = new Uau(
      uauConfig.uauSettings,
      new WorkersKVDB(env.KV),
      uauConfig.statics
    )

    try {
      return uauInstance.handleRequest(request, ctx.waitUntil.bind(ctx))
    } catch (e) {
      console.log('ERRR', String(e), request)
    }
  },
}
