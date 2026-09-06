import client from './client'
import type { PageProperties, PropertyDefinition } from '@/types'

export type PropertyOperation = { op: 'SET', key: string, value?: unknown } | { op: 'REMOVE', key: string }
export const listPropertyDefinitions = () => client.get<PropertyDefinition[]>('/property-definitions')
export const createPropertyDefinition = (input: unknown) => client.post<PropertyDefinition>('/property-definitions', input)
export const updatePropertyDefinition = (id: string, input: unknown) => client.patch<PropertyDefinition>(`/property-definitions/${id}`, input)
export const deletePropertyDefinition = (id: string) => client.delete(`/property-definitions/${id}`)
export const getPageProperties = (slug: string, signal?: AbortSignal) =>
  client.get<PageProperties>(`/pages/${encodeURIComponent(slug)}/properties`, { signal })
export const patchPageProperties = (slug: string, expectedUpdatedAt: string, operations: PropertyOperation[]) =>
  client.patch(`/pages/${encodeURIComponent(slug)}/properties`, { expectedUpdatedAt, operations })
