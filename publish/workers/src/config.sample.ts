import { UauWorkersConfig, WorkersKVDB } from './interface'

const _: UauWorkersConfig = {
  uauSettings: {
    apiPrefix: '/_',
    maxDefinedPathLevel: 2,
    allowCors: ['uau.li'],
    maxGuestValidity: 300, // 5 minutes
    adminToken: '5bf3e171-d684-42ac-a2fa-397b59181f24', // can be anything actually
  },
  storage: new WorkersKVDB(KV),
  statics: {
    '': 'https://uauli.pages.dev/',
  },
}

export default _
