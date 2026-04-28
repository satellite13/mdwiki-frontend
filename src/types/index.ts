export type UserRole = 'READER' | 'EDITOR' | 'ADMIN'

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  token: string
  username: string
  role: UserRole
}

export interface Page {
  id: string
  slug: string
  title: string
  contentMd: string | null
  tags: string[]
  createdBy: string | null
  updatedBy: string | null
  folderPath?: FolderPathItem[]
  createdAt: string
  updatedAt: string
}

export interface PageListItem {
  id: string
  slug: string
  title: string
  tags: string[]
  folderId: string | null
  updatedAt: string
}

export interface FolderPathItem {
  id: string
  name: string
}

export interface FolderTreeNode {
  id: string
  name: string
  type: 'folder' | 'page'
  slug?: string
  children: FolderTreeNode[]
}

export interface Backlink {
  slug: string
  title: string
}

export interface Tag {
  id: string
  name: string
  pageCount: number
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

export interface Attachment {
  id: string
  originalName: string
  storedName: string
  contentType: string
  sizeBytes: number
  uploadedBy: string | null
  pageId: string | null
  url: string
  createdAt: string
}

export interface EmbeddingSettingsWarning {
  code: string
  message: string
  expectedDimension: number
  actualDimension: number
}

export interface EmbeddingSettings {
  provider: 'openai' | 'ollama' | 'lmstudio'
  model: string
  baseUrl: string
  apiKeyConfigured: boolean
  expectedDimension: number
  warning?: EmbeddingSettingsWarning | null
}
