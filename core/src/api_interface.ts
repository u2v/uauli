import { UauItem } from './interface'

export interface APIGetResponse {
  found: boolean
  item?: UauItem
}

export interface APIPostResponse {
  ok: boolean
  reason?: string
}
