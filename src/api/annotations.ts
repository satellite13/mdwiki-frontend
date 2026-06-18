import client from './client'
import type { Annotation, CreateAnnotationPayload, UpdateAnnotationPayload } from '@/types'

export function listAnnotations(slug: string) {
  return client.get<Annotation[]>(`/pages/${slug}/annotations`)
}

export function createAnnotation(slug: string, payload: CreateAnnotationPayload) {
  return client.post<Annotation>(`/pages/${slug}/annotations`, payload)
}

export function updateAnnotation(id: string, payload: UpdateAnnotationPayload) {
  return client.put<Annotation>(`/annotations/${id}`, payload)
}

export function deleteAnnotation(id: string) {
  return client.delete<void>(`/annotations/${id}`)
}
