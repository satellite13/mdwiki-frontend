/** В дереве документов id папки приходит как `folder-<uuid>`; REST API ждёт только UUID. */
export function stripFolderPrefix(id: string): string {
  return id.startsWith('folder-') ? id.slice(7) : id
}
