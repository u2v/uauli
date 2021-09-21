export interface UauGlobal {
  // options
  validity?: number
  // properties
  createdAt: Date
  payload: string
}

/// Update utils:validateUauItem also when adding to here

export interface UauWithLink extends UauGlobal {
  type: 'link'
  inheritPath: boolean
  inheritParam: boolean
}

export interface UauWithPayload extends UauGlobal {
  type: 'payload'
  contentType?: string
}

export type UauItem = UauWithLink | UauWithPayload

export interface DBInterface {
  read(path: string): Promise<UauItem | null>
  write(path: string, item: UauItem): Promise<void>
  delete(path: string): Promise<void>
}

export interface UauInstance {
  storage: DBInterface
  handleRequest(request: Request): Promise<Response>
}

export interface UauSiteSettings {
  apiPrefix: string
  maxDefinedPathLevel: number
  allowCors: boolean | string[]
  maxGuestValidity: number
  adminToken: string
}

export interface UauSiteInstance extends UauInstance {
  settings: UauSiteSettings
}
