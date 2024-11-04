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

export interface UauSitePublicSettings {
  apiPrefix: string
  maxDefinedPathLevel: number
  maxGuestValidity: number
  lockdownMode: boolean
}

export interface UauSiteSettings extends UauSitePublicSettings {
  allowCors: boolean | string[]
  adminToken: string
  umamiConfig?: UmamiConfig
}

export interface UauSiteInstance extends UauInstance {
  settings: UauSiteSettings
}

export interface UmamiConfig {
  domain: string
  websiteId: string
}
