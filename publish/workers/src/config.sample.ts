import { UauWorkersConfig, WorkersKVDB } from './interface'

const _: UauWorkersConfig = {
  uauSettings: {
    apiPrefix: '/_',
    maxDefinedPathLevel: 2,
    allowCors: ['uau.li', 'two.li'],
    maxGuestValidity: 300, // 5 minutes
    adminToken: '5bf3e171-d684-42ac-a2fa-397b59181f24', // can be anything actually
    lockdownMode: true,
    umamiConfig: {
      domain: 'umami.example.com',
      websiteId: '28addf68-9a92-487b-9fd3-7d5592c9e404',
    },
  },
  statics: {
    '': 'https://uauli.pages.dev/',
  },
}

export default _
