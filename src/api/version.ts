import client from './client'

export interface BackendVersion {
  name: string
  version: string
  versionTag: string
  gitSha: string
}

export function getBackendVersion() {
  return client.get<BackendVersion>('/version')
}
