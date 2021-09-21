import type { DBInterface, UauSiteSettings } from '@uau/core/src/interface'
import { WorkersKVDB } from './interface'

const _: {
  uauSettings: UauSiteSettings
  storage: DBInterface
} = {
  uauSettings: {
    apiPrefix: '/_',
    maxDefinedPathLevel: 2,
    allowCors: ['uau.li'],
    maxGuestValidity: 300, // 5 minutes
    adminToken: '5bf3e171-d684-42ac-a2fa-397b59181f24', // can be anything actually
  },
  storage: new WorkersKVDB(KV),
}

export default _
