import { customAlphabet } from 'nanoid'
import type { APIPostResponse, APIGetResponse } from './api_interface'
import type {
  DBInterface,
  UauItem,
  UauSiteInstance,
  UauSitePublicSettings,
  UauSiteSettings,
  UmamiConfig,
} from './interface'
import {
  checkMatchPrefix,
  pathIterator,
  shimContentType,
  statusedJsonResponse,
  statusedResponse,
  toURL,
  validateCors,
  validateUauItem,
  withCorsHeaders,
} from './utils'

const NANOID_DICT = '6789BCDFGHJKLMNPQRTW'
const PRESERVED_PATH_PREFIXES = ['/.well-known', '/robots.txt']
const nanoid = customAlphabet(NANOID_DICT, 5)

export class Uau implements UauSiteInstance {
  storage: DBInterface
  settings: UauSiteSettings
  statics: { [key: string]: string }

  constructor(
    settings: UauSiteSettings,
    storage: DBInterface,
    statics: { [key: string]: string } = {}
  ) {
    this.settings = settings
    this.storage = storage
    this.statics = statics
    // Post-fix
    {
      let prefix = this.settings.apiPrefix
      if (!prefix.startsWith('/')) prefix = '/' + prefix
      prefix = prefix.replace(/\/\//g, '/')
      prefix = prefix.replace(/\/$/, '')
      this.settings.apiPrefix = prefix
    }
  }

  async handleApiRequest(request: Request): Promise<Response> {
    const source = new URL(request.url)
    const path = source.pathname
      .replace(/\/$/, '')
      .slice(this.settings.apiPrefix.length)
      .toLowerCase()
    let body

    if (path.length === 0) {
      switch (request.method) {
        case 'GET': {
          return statusedJsonResponse<
            Omit<UauSitePublicSettings, 'maxDefinedPathLevel'>
          >(200, {
            apiPrefix: this.settings.apiPrefix,
            maxGuestValidity: this.settings.maxGuestValidity,
            lockdownMode: this.settings.lockdownMode,
            ...(this.settings.lockdownMode
              ? {}
              : {
                  maxDefinedPathLevel: this.settings.maxDefinedPathLevel,
                }),
          })
        }
        case 'PUT': {
          try {
            body = await request.json()
          } catch (e) {
            return statusedJsonResponse<APIPostResponse>(400, {
              ok: false,
              path,
              reason: `Bad JSON body: ${e}`,
            })
          }
          return await this.createLink(`/${nanoid()}`.toLowerCase(), body, true)
        }
        default: {
          return statusedResponse(405)
        }
      }
    }

    try {
      body = await request.json()
    } catch (e) {
      return statusedJsonResponse<APIPostResponse>(400, {
        ok: false,
        path,
        reason: `Bad JSON body: ${e}`,
      })
    }

    switch (request.method) {
      // Update CORS when adding to this
      case 'GET': {
        const item = await this.storage.read(path)
        if (item === null) {
          return statusedJsonResponse<APIGetResponse>(404, {
            found: false,
          })
        }
        return statusedJsonResponse<APIGetResponse>(404, {
          found: true,
          item,
        })
      }
      case 'PUT': {
        return await this.createLink(path, body, this.checkIdentity(request))
      }
      case 'DELETE': {
        const item = await this.storage.read(path)
        if (item === null) {
          return statusedJsonResponse<APIPostResponse>(404, {
            ok: false,
            path,
            reason: 'The entry to delete does not exist',
          })
        }
        if (!this.checkIdentity(request)) {
          return statusedJsonResponse<APIPostResponse>(403, {
            ok: false,
            path,
            reason: 'Invalid request for guests',
          })
        }
        await this.storage.delete(path)
        return statusedJsonResponse<APIPostResponse>(200, {
          ok: true,
          path,
        })
      }
    }
    return statusedResponse(400, 'Invalid request')
  }
  async checkConflict(
    path: string,
    override: boolean
  ): Promise<Response | null> {
    for (let pathSlice of pathIterator(
      path,
      this.settings.maxDefinedPathLevel
    )) {
      const result = await this.storage.read(pathSlice)
      if (result === null) continue
      if (path === pathSlice && !override)
        return statusedJsonResponse<APIPostResponse>(400, {
          ok: false,
          path,
          reason: `Item for this path already exists`,
        })
      if (result.type === 'payload') continue
      if (result.inheritPath)
        return statusedJsonResponse<APIPostResponse>(400, {
          ok: false,
          path,
          reason: `Conflict with a inherited path on ${pathSlice}`,
        })
    }
    return null
  }
  checkIdentity(request: Request): boolean {
    return (
      request.headers.get('Authorization') ===
      `Bearer ${this.settings.adminToken}`
    )
  }

  async handleRequest(
    request: Request,
    handlePromise: (x: Promise<unknown>) => void = (x) => Promise.resolve(x)
  ): Promise<Response> {
    const acaoResult = validateCors(
      request.headers.get('Origin'),
      this.settings.allowCors
    )

    if (request.method === 'OPTIONS') {
      // CORS
      return withCorsHeaders(statusedResponse(204), acaoResult)
    }

    const source = new URL(request.url)
    const path = source.pathname.replace(/\/$/, '').replace(/^\/~/, '/')

    if (this.settings.umamiConfig) {
      handlePromise(logRequest(request, this.settings.umamiConfig))
    }

    if (this.statics[path]) {
      const resp = await fetch(this.statics[path])
      return resp.clone()
    }

    // Settings
    if (path.startsWith(this.settings.apiPrefix)) {
      return withCorsHeaders(await this.handleApiRequest(request), acaoResult)
    }

    if (request.method !== 'GET') {
      return withCorsHeaders(
        statusedJsonResponse<APIPostResponse>(405, {
          ok: false,
          path,
          reason: 'Invalid path for API',
        }),
        acaoResult
      )
    }

    const pathLowercase = path.toLowerCase()
    for (let pathSlice of pathIterator(
      pathLowercase,
      this.settings.maxDefinedPathLevel
    )) {
      const result = await this.storage.read(pathSlice)
      if (
        result !== null &&
        ((result.type === 'link' && result.inheritPath) ||
          pathSlice === pathLowercase)
      ) {
        return withCorsHeaders(
          this.buildResponse(request, result, pathSlice),
          acaoResult
        )
      }
    }

    // Default
    return withCorsHeaders(
      new Response(`Not found for ${path}`, {
        status: 404,
      }),
      acaoResult
    )
  }

  async createLink(
    path: string,
    rawPayload: Record<string, any>,
    identityOk: boolean
  ) {
    if (path.split('/').length > this.settings.maxDefinedPathLevel + 1) {
      return statusedJsonResponse<APIPostResponse>(400, {
        ok: false,
        path,
        reason: `Max defined path level is ${
          this.settings.maxDefinedPathLevel
        }, while your path level is ${path.split('/').length - 1}`,
      })
    }
    const override = rawPayload.override === true
    if ((override || this.settings.lockdownMode) && !identityOk) {
      return statusedJsonResponse<APIPostResponse>(403, {
        ok: false,
        path,
        reason: 'Permission denied.',
      })
    }
    if (!override && checkMatchPrefix(path, PRESERVED_PATH_PREFIXES)) {
      return statusedJsonResponse<APIPostResponse>(400, {
        ok: false,
        path,
        reason: 'Path prefixes are reserved. Set `override` to proceed.',
      })
    }
    const ifConflict = await this.checkConflict(path, override)
    if (ifConflict) {
      return ifConflict
    }

    let [ok, item] = validateUauItem(rawPayload)
    if (!ok) {
      return statusedJsonResponse<APIPostResponse>(400, {
        ok: false,
        path,
        reason: `Invalid item: ${item}`,
      })
    }

    item = <UauItem>item
    // Authorization
    if (
      this.settings.maxGuestValidity !== 0 &&
      (item.validity == undefined ||
        item.validity > this.settings.maxGuestValidity)
    ) {
      if (!identityOk) {
        return statusedJsonResponse<APIPostResponse>(403, {
          ok: false,
          path,
          reason: 'Invalid request for guests',
        })
      }
    }

    await this.storage.write(path, item)
    return statusedJsonResponse<APIPostResponse>(200, {
      ok: true,
      path,
    })
  }

  buildResponse(request: Request, result: UauItem, selector: string): Response {
    switch (result.type) {
      case 'link': {
        const origin = new URL(request.url)
        const finalUrl = toURL(result.payload)
        if (finalUrl === null) {
          return statusedResponse(500, `Bad payload URL: Invalid payload`)
        }
        if (result.inheritPath && origin.pathname.startsWith(selector)) {
          finalUrl.pathname += origin.pathname.slice(selector.length)
        }
        if (result.inheritParam) {
          origin.searchParams.forEach((v, k) => {
            finalUrl.searchParams.set(k, v)
          })
        }
        return new Response(String(finalUrl), {
          status: 302,
          headers: {
            'X-Robots-Tag': 'none',
            Location: String(finalUrl),
          },
        })
      }
      case 'payload': {
        return new Response(result.payload, {
          headers: {
            ...(result.contentType
              ? {
                  'Content-Type': shimContentType(result.contentType),
                }
              : {}),
          },
        })
      }
      default: {
        // @ts-ignore
        return statusedResponse(500, `Bad item type: ${result.type}`)
      }
    }
  }
}

async function logRequest(req: Request, config: UmamiConfig): Promise<void> {
  const url = new URL(req.url)

  await fetch(`https://${config.domain}/api/send`, {
    body: JSON.stringify({
      payload: {
        website: config.websiteId,
        url: url.pathname + url.search,
        hostname: url.hostname,
        language: req.headers.get('Accept-Language'),
        screen: '1920x1080',
        ...(req.headers.get('Referer')
          ? { referrer: req.headers.get('Referer') }
          : {}),
      },
      type: 'event',
    }),
    headers: {
      'User-Agent': req.headers.get('User-Agent') ?? 'UauLi/1.0',
      'Content-Type': 'application/json',
      'X-Forwarded-For': String(req.headers.get('CF-Connecting-IP')),
    },
    method: 'POST',
  }).then((x) => x.text())
}
