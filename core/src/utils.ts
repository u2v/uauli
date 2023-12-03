import type { UauGlobal, UauItem, UauSiteSettings } from './interface'

export function toURL(url: string): URL | null {
  try {
    return new URL(url)
  } catch (_) {
    return null
  }
}

export function validateUauItem(p: any): [true, UauItem] | [false, string] {
  // This should be in sync with interface.ts

  // UauGlobal::Check
  if (p.type !== 'link' && p.type !== 'payload') return [false, 'Bad type']
  if (p.validity !== undefined && typeof p.validity !== 'number')
    return [false, 'Bad validity']

  // UauGlobal::normalize
  p.createdAt = new Date(p.createdAt)

  const base: UauGlobal = {
    createdAt: new Date(),
    validity: p.validity,
    payload: p.payload,
  }

  if (p.type === 'link') {
    if (toURL(p.payload) === null) return [false, 'Invalid URL']
    return [
      true,
      {
        ...base,
        type: 'link',
        inheritParam: Boolean(p.inheritParam),
        inheritPath: Boolean(p.inheritPath),
      },
    ]
  } else if (p.type === 'payload') {
    if (typeof p.contentType !== 'string') return [false, 'Invalid contentType']
    return [
      true,
      {
        ...base,
        type: 'payload',
        contentType: p.contentType,
      },
    ]
  }
  return [false, 'Unknown error']
}

export function* pathIterator(
  path: string,
  pathLevel: number
): Generator<string> {
  const pathSeq = path.split('/')
  for (let i = Math.min(pathLevel + 1, pathSeq.length) - 1; i >= 1; i--) {
    yield pathSeq.slice(0, i + 1).join('/')
  }
}

export function shimContentType(type: string): string {
  if (type !== 'text/plain') return type
  return type + '; charset=UTF-8'
}

export function validateCors(
  origin: string | null,
  allowCors: UauSiteSettings['allowCors']
) {
  if (allowCors === true) {
    return '*'
  }

  if (allowCors === false || origin === null) {
    return ''
  }

  return allowCors.includes(origin.replace(/^https:\/\//, '')) ? origin : ''
}

export function withCorsHeaders(r: Response, acaoResult: string): Response {
  for (const [key, value] of Object.entries({
    'Access-Control-Allow-Headers': ['Authentication', 'Content-Type'].join(
      ', '
    ),
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Origin': acaoResult,
  })) {
    r.headers.set(key, value)
  }

  return r
}

export function statusedResponse(
  status: number,
  payload?: BodyInit,
  headers?: HeadersInit
): Response {
  return new Response(payload, {
    status,
    headers,
  })
}

export function statusedJsonResponse<T>(status: number, payload: T): Response {
  return statusedResponse(status, JSON.stringify(payload), {
    'Content-Type': 'application/json',
  })
}
