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
  deletedAt?: string | null
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
  updatedAt?: string | null
  tags?: string[]
}

export interface RagSearchResult {
  pageSlug: string
  pageTitle: string
  sectionHeading: string | null
  sectionKey?: string | null
  snippet: string
  score: number
  tags: string[]
  updatedAt?: string | null
}

export interface PageSectionMapItem {
  key: string
  stableId?: string | null
  heading: string | null
  headingPath: string
  level: number
  length: number
  hash: string
  includesChildren: boolean
}

export type RevisionOperation =
  | 'CREATE' | 'EDIT' | 'PATCH' | 'RESTORE' | 'IMPORT' | 'FILESYSTEM' | 'RENAME'
  | 'DELETE' | 'RESTORE_TRASH'
export interface RevisionSummary {
  revisionNo: number
  contentHash: string
  title: string
  slug: string
  folderId: string | null
  deletedAt?: string | null
  operation: RevisionOperation
  createdByName: string | null
  createdAt: string
  restoredFromRevisionNo: number | null
}
export interface RevisionSnapshot extends RevisionSummary {
  id: string
  contentMd: string
}

export type SavedSearchMode = 'HYBRID' | 'TEXT' | 'SEMANTIC'
export type SavedSearchSort = 'RELEVANCE' | 'UPDATED'
export interface SavedSearch {
  id: string
  name: string
  queryText: string
  mode: SavedSearchMode
  tags: string[]
  minScore: number | null
  sort: SavedSearchSort
  version: number
  createdAt: string
  updatedAt: string
}

export type PropertyType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'URL' | 'SELECT' | 'MULTI_SELECT' | 'PAGE_REF'
export interface PropertyDefinition {
  id: string
  key: string
  displayName: string
  type: PropertyType
  config: Record<string, unknown>
  required: boolean
  version: number
  createdAt: string
  updatedAt: string
}
export interface PageProperties {
  definitions: PropertyDefinition[]
  values: Record<string, unknown>
  unknown: Record<string, unknown>
  warnings: string[]
}
export type SavedViewType = 'TABLE' | 'LIST' | 'CARDS'
export interface SavedView {
  id: string
  name: string
  type: SavedViewType
  filters: unknown[]
  sort: unknown[]
  grouping: unknown | null
  layout: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
}

export interface AnswerCitation {
  id: number
  pageSlug: string
  pageTitle: string
  sectionKey: string | null
  sectionHeading: string | null
  quote: string
  score: number
}
export interface AnswerResponse {
  answerMd: string
  citations: AnswerCitation[]
  grounded: boolean
  model: 'extractive-rag'
}

export interface StableLinkResponse {
  stableId: string
  sectionKey: string
  pageSlug: string
  updatedAt: string
  url: string
  page: Page | null
}

export interface PageSectionMapResponse {
  slug: string
  updatedAt: string
  sections: PageSectionMapItem[]
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
  clearComment?: boolean
  clearColor?: boolean
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

export type ImportMdItemStatus = 'created' | 'updated' | 'skipped' | 'error'

export interface ImportMdItemResult {
  filename: string
  slug?: string | null
  title?: string | null
  status: ImportMdItemStatus
  message?: string | null
}

export interface ImportMdPagesResponse {
  results: ImportMdItemResult[]
  created: number
  updated: number
  skipped: number
  errors: number
}

export interface BundleExportRequest {
  pageSlugs: string[]
  folderIds: string[]
}

export interface BundlePreviewPage {
  slug: string
  title: string
  folderPath: string[]
}

export interface BundlePreviewFolder {
  path: string[]
  name: string
}

export interface BundlePreviewAttachment {
  storedName: string
  originalName: string
  sizeBytes: number
  referencedBy: string[]
}

export interface BundlePreviewResponse {
  folders: BundlePreviewFolder[]
  pages: BundlePreviewPage[]
  attachments: BundlePreviewAttachment[]
  attachmentCount: number
  attachmentBytes: number
  warnings: string[]
}

export interface BundleSlugRemap {
  from: string
  to: string
}

export interface BundleImportResponse {
  createdPages: number
  createdFolders: number
  remappedSlugs: BundleSlugRemap[]
  attachments: number
  errors: string[]
}

export interface CaptureResponse {
  kind: 'text' | 'url' | 'image'
  page: Page
  attachment?: Attachment | null
}

export interface DailyNoteResponse {
  date: string
  page: Page
  created: boolean
}

export interface RecentPage {
  page: PageListItem
  lastOpenedAt: string
  openCount: number
}

export interface FavoritePage {
  page: PageListItem
  favoritedAt: string
}

export interface UnlinkedMention {
  sourceSlug: string
  sourceTitle: string
  snippet: string
  sectionKey?: string | null
  startOffset: number
  endOffset: number
  expectedUpdatedAt: string
}

export type OrphanDefinition = 'NO_INCOMING' | 'NO_LINKS' | 'NO_OUTGOING'
export interface OrphanPage {
  page: PageListItem
  incomingCount: number
  outgoingCount: number
}
