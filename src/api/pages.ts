import client from './client'
import type { Page, PageListItem, Backlink } from '@/types'

export function listPages() { return client.get<PageListItem[]>('/pages') }
export function getPage(slug: string) { return client.get<Page>(`/pages/${slug}`) }
export function getBacklinks(slug: string) { return client.get<Backlink[]>(`/pages/${slug}/backlinks`) }
export function createPage(slug: string, title: string, contentMd: string) { return client.post<Page>('/pages', { slug, title, contentMd }) }
export function updatePage(slug: string, data: { title?: string; contentMd?: string }) { return client.put<Page>(`/pages/${slug}`, data) }
export function deletePage(slug: string) { return client.delete(`/pages/${slug}`) }
