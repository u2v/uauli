import type { APIPostResponse, APIGetResponse } from './api_interface'
import type {
  DBInterface,
  UauItem,
  UauSiteInstance,
  UauSitePublicSettings,
  UauSiteSettings,
} from './interface'
import {
  pathIterator,
  shimContentType,
  toURL,
  validateCors,
  validateUauItem,
  withCorsHeaders,
} from './utils'

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

  statusedResponse(
    status: number,
    payload?: BodyInit,
    headers?: HeadersInit
  ): Response {
    return new Response(payload, {
      status,
      headers,
    })
  }

  statusedJsonResponse<T>(status: number, payload: T): Response {
    return this.statusedResponse(status, JSON.stringify(payload), {
      'Content-Type': 'application/json',
    })
  }

  async handleApiRequest(request: Request): Promise<Response> {
    const source = new URL(request.url)
    const path = source.pathname
      .replace(/\/$/, '')
      .slice(this.settings.apiPrefix.length)
      .toLowerCase()
    if (path.length === 0) {
      return this.statusedJsonResponse<UauSitePublicSettings>(200, {
        apiPrefix: this.settings.apiPrefix,
        maxDefinedPathLevel: this.settings.maxDefinedPathLevel,
        maxGuestValidity: this.settings.maxGuestValidity,
      })
    }
    switch (request.method) {
      // Update CORS when adding to this
      case 'GET': {
        const item = await this.storage.read(path)
        if (item === null) {
          return this.statusedJsonResponse<APIGetResponse>(404, {
            found: false,
          })
        }
        return this.statusedJsonResponse<APIGetResponse>(404, {
          found: true,
          item,
        })
      }
      case 'PUT': {
        if (path.split('/').length > this.settings.maxDefinedPathLevel + 1) {
          return this.statusedJsonResponse<APIPostResponse>(400, {
            ok: false,
            reason: `Max defined path level is ${
              this.settings.maxDefinedPathLevel
            }, while your path level is ${path.split('/').length - 1}`,
          })
        }
        const rawPayload = await request.json()
        const override = rawPayload.override === true
        if (override && !this.checkIdentity(request)) {
          return this.statusedJsonResponse<APIPostResponse>(403, {
            ok: false,
            reason: 'Permission denied for override.',
          })
        }
        const ifConflict = await this.checkConflict(path, override)
        if (ifConflict) {
          return ifConflict
        }

        let [ok, item] = validateUauItem(rawPayload)
        if (!ok) {
          return this.statusedJsonResponse<APIPostResponse>(400, {
            ok: false,
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
          if (!this.checkIdentity(request)) {
            return this.statusedJsonResponse<APIPostResponse>(403, {
              ok: false,
              reason: 'Invalid request for guests',
            })
          }
        }

        await this.storage.write(path, item)
        return this.statusedJsonResponse<APIPostResponse>(200, {
          ok: true,
        })
      }
      case 'DELETE': {
        const item = await this.storage.read(path)
        if (item === null) {
          return this.statusedJsonResponse<APIPostResponse>(404, {
            ok: false,
            reason: 'The entry to delete does not exist',
          })
        }
        if (!this.checkIdentity(request)) {
          return this.statusedJsonResponse<APIPostResponse>(403, {
            ok: false,
            reason: 'Invalid request for guests',
          })
        }
        await this.storage.delete(path)
        return this.statusedJsonResponse<APIPostResponse>(200, {
          ok: true,
        })
      }
    }
    return this.statusedResponse(400, 'Invalid request')
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
        return this.statusedJsonResponse<APIPostResponse>(400, {
          ok: false,
          reason: `Item for this path already exists`,
        })
      if (result.type === 'payload') continue
      if (result.inheritPath)
        return this.statusedJsonResponse<APIPostResponse>(400, {
          ok: false,
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

  async handleRequest(request: Request): Promise<Response> {
    const acaoResult = validateCors(
      request.headers.get('Origin'),
      this.settings.allowCors
    )

    if (request.method === 'OPTIONS') {
      // CORS
      return withCorsHeaders(this.statusedResponse(204), acaoResult)
    }

    const source = new URL(request.url)
    const path = source.pathname.replace(/\/$/, '').replace(/^\/~/, '/')

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
        this.statusedJsonResponse<APIPostResponse>(405, {
          ok: false,
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

  buildResponse(request: Request, result: UauItem, selector: string): Response {
    switch (result.type) {
      case 'link': {
        const origin = new URL(request.url)
        const finalUrl = toURL(result.payload)
        if (finalUrl === null) {
          return this.statusedResponse(500, `Bad payload URL: Invalid payload`)
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

async function logRequest(request: Request): Promise<void> {
  const reqUrl = new URL(request.url)

  await fetch('https://umami.outv.im/api/collect', {
    method: 'POST',
    body: JSON.stringify({
      payload: {
        website: '28e37073-d7be-4909-9b4f-f36952cf0f0e',
        url: reqUrl.pathname,
        referrer: request.headers.get('Referer'),
        hostname: reqUrl.hostname,
        language: request.headers.get('Accept-Language') || '',
      },
      type: 'pageview',
    }),
    // @ts-ignore
    headers: {
      'CF-Connecting-IP': request.headers.get('CF-Connecting-IP'),
      'User-Agent': request.headers.get('User-Agent'),
      Referer: request.headers.get('Referer'),
    },
  })
}
