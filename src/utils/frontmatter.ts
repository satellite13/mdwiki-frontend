/**
 * YAML frontmatter: открывающая строка `---`, блок YAML, закрывающая `---` как отдельная строка.
 * Горизонтальная линия в теле (`# x\n\n---\n`) не затрагивается — блок только в начале файла.
 */
const FRONTMATTER_FENCE =
  /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m

export function stripMarkdownFrontmatter(markdown: string): string {
  const src = markdown ?? ''
  const m = FRONTMATTER_FENCE.exec(src)
  if (!m) return src
  return src.slice(m.index + m[0].length).replace(/^[\r\n]+/, '')
}
