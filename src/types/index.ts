export interface User {
  id: string
  username: string
  email: string
  role: 'READER' | 'EDITOR' | 'ADMIN'
}

export interface AuthResponse {
  token: string
  username: string
  role: string
}

export interface Page {
  id: string
  slug: string
  title: string
  contentMd: string | null
  contentHtml: string | null
  tags: string[]
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PageListItem {
  id: string
  slug: string
  title: string
  tags: string[]
  updatedAt: string
}

export interface Backlink {
  slug: string
  title: string
}

export interface Tag {
  id: string
  name: string
}

export interface SearchResult {
  pageId: string
  slug: string
  title: string
  snippet: string
}

export interface ApiKey {
  id: string
  name: string
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
}

export interface ApiKeyCreated {
  id: string
  name: string
  key: string
  createdAt: string
  expiresAt: string | null
}
