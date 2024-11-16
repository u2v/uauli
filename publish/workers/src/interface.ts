import { DBInterface, UauItem, UauSiteSettings } from '@uau/core/src/interface'

function parseOrNull(v: string | null): any {
  return v === null ? null : JSON.parse(v)
}

export class WorkersKVDB implements DBInterface {
  _kv: KVNamespace

  constructor(kv: KVNamespace) {
    this._kv = kv
  }

  async read(path: string): Promise<UauItem | null> {
    return parseOrNull(await this._kv.get(path))
  }

  write(path: string, item: UauItem): Promise<void> {
    return this._kv.put(
      path,
      JSON.stringify(item),
      item.validity
        ? {
            expirationTtl: item.validity,
          }
        : undefined
    )
  }

  delete(path: string): Promise<void> {
    return this._kv.delete(path)
  }
}

export interface UauWorkersConfig {
  uauSettings: UauSiteSettings
  statics: { [key: string]: string }
}
