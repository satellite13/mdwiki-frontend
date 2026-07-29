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
  locked: boolean
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

export type BrokenLinkKind = 'WIKILINK' | 'MARKDOWN'

export interface BrokenLink {
  id: string | null
  brokenTarget: string
  kind: BrokenLinkKind
  sourceSlug: string
  sourceTitle: string
  displayText?: string | null
}

export interface RewriteBrokenLinksResult {
  pagesUpdated: number
  skippedLocked: string[]
}

export interface OpenTask {
  documentId: string
  slug: string
  documentTitle: string
  text: string
  sourceOffset: number
  sourceLine: string
  updatedAt: string
  locked: boolean
}

export interface CompleteTaskPayload {
  documentId: string
  updatedAt: string
  sourceOffset: number
  sourceLine: string
  summary?: string
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

export interface RagSearchResult {
  pageSlug: string
  pageTitle: string
  sectionHeading: string | null
  snippet: string
  score: number
  tags: string[]
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

export interface Annotation {
  id: string
  pageId: string
  highlightedText: string
  anchorContext: string
  comment: string | null
  rangeStart: number | null
  rangeEnd: number | null
  color: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateAnnotationPayload {
  highlightedText: string
  anchorContext: string
  comment?: string | null
  rangeStart?: number | null
  rangeEnd?: number | null
  color?: string | null
}

export interface UpdateAnnotationPayload {
  comment?: string | null
  color?: string | null
}

export interface EmbeddingSettings {
  provider: 'openai' | 'ollama' | 'lmstudio'
  model: string
  baseUrl: string
  apiKeyConfigured: boolean
  expectedDimension: number
  warning?: EmbeddingSettingsWarning | null
}

export type ReadingTheme = 'white' | 'paper' | 'dark'
