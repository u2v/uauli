import type { UauItem } from './interface'

export interface APIGetResponse {
  found: boolean
  item?: UauItem
}

export interface APIPostResponse {
  ok: boolean
  path: string
  reason?: string
}
