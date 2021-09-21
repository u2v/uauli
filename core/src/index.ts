import { APIPostResponse, APIGetResponse } from './api_interface'
import {
  DBInterface,
  UauItem,
  UauSiteInstance,
  UauSiteSettings,
} from './interface'
import {
  pathIterator,
  statusedJsonResponse,
  statusedResponse,
  toURL,
  validateUauItem,
} from './utils'

export class Uau implements UauSiteInstance {
  storage: DBInterface
  settings: UauSiteSettings

  constructor(settings: UauSiteSettings, storage: DBInterface) {
    this.settings = settings
    this.storage = storage
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
    if (!source.pathname.startsWith(this.settings.apiPrefix)) {
      return statusedResponse(400, 'Not implemented yet')
    }
    const path = source.pathname
      .replace(/\/$/, '')
      .slice(this.settings.apiPrefix.length)
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
        if (path.split('/').length > this.settings.maxDefinedPathLevel + 1) {
          return statusedJsonResponse<APIPostResponse>(400, {
            ok: false,
            reason: `Max defined path level is ${
              this.settings.maxDefinedPathLevel
            }, while your path level is ${path.split('/').length - 1}`,
          })
        }
        const ifConflict = await this.checkConflict(path)
        if (ifConflict) {
          return ifConflict
        }
        const rawPayload = await request.json()
        let [ok, item] = validateUauItem(rawPayload)
        if (!ok) {
          return statusedJsonResponse<APIPostResponse>(400, {
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
            return statusedJsonResponse<APIPostResponse>(403, {
              ok: false,
              reason: 'Invalid request for guests',
            })
          }
        }

        await this.storage.write(path, item)
        return statusedJsonResponse<APIPostResponse>(200, {
          ok: true,
        })
      }
      case 'DELETE': {
        const item = await this.storage.read(path)
        if (item === null) {
          return statusedJsonResponse<APIPostResponse>(404, {
            ok: false,
            reason: 'The entry to delete does not exist',
          })
        }
        if (!this.checkIdentity(request)) {
          return statusedJsonResponse<APIPostResponse>(403, {
            ok: false,
            reason: 'Invalid request for guests',
          })
        }
        await this.storage.delete(path)
        return statusedJsonResponse<APIPostResponse>(200, {
          ok: true,
        })
      }
    }
    return statusedResponse(400, 'Invalid request')
  }
  async checkConflict(path: string): Promise<Response | null> {
    for (let pathSlice of pathIterator(
      path,
      this.settings.maxDefinedPathLevel
    )) {
      const result = await this.storage.read(pathSlice)
      if (result === null) continue
      if (path === pathSlice)
        return statusedJsonResponse<APIPostResponse>(400, {
          ok: false,
          reason: `Item for this path already exists`,
        })
      if (result.type === 'payload') continue
      if (result.inheritPath)
        return statusedJsonResponse<APIPostResponse>(400, {
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

  handleCORS(): Response {
    const corsSetting = this.settings.allowCors
    if (corsSetting === true) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': '*',
        },
      })
    }
    if (corsSetting === false) {
      return new Response(null, {
        status: 403,
      })
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsSetting.join(', '),
        'Access-Control-Allow-Methods': '*',
      },
    })
  }

  async handleRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      // CORS
      return this.handleCORS()
    }

    const source = new URL(request.url)
    const path = source.pathname.replace(/\/$/, '')

    // Settings
    if (path.startsWith(this.settings.apiPrefix)) {
      return this.handleApiRequest(request)
    }

    for (let pathSlice of pathIterator(
      path,
      this.settings.maxDefinedPathLevel
    )) {
      const result = await this.storage.read(pathSlice)
      if (
        result !== null &&
        ((result.type === 'link' && result.inheritPath) || pathSlice === path)
      ) {
        return this.buildResponse(request, result, pathSlice)
      }
    }

    // Default
    return new Response('Not Found', {
      status: 404,
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
            Location: String(finalUrl),
          },
        })
      }
      case 'payload': {
        return new Response(result.payload, {
          headers: {
            ...(result.contentType
              ? {
                  'Content-Type': result.contentType,
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
