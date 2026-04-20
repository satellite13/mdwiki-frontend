/**
 * YAML frontmatter: открывающая строка `---`, блок YAML, закрывающая `---` как отдельная строка.
 *
 * Раньше использовался регэксп с «ленивым» блоком до первой строки `---` в файле — горизонтальная
 * черта в теле (`... текст\n\n---\n\n## Секция`) ошибочно считалась концом фронтматтера, и в превью
 * оставался только хвост документа после этой линии.
 *
 * Закрывающий забор принимаем только если строки между открытием и этой строкой похожи на YAML
 * (пустые, `ключ:`, элементы списка `- `, продолжения с отступом). Иначе это `---` в теле — ищем
 * следующий кандидат или не трогаем файл.
 */
export const MAX_FRONTMATTER_LINES = 400

function isFenceLine(line: string): boolean {
  return /^---[ \t]*$/.test(line)
}

/** Строка внутри предполагаемого YAML-блока (между открывающим и закрывающим `---`). */
function isYamlishLine(line: string): boolean {
  const t = line.trimEnd()
  if (t.length === 0) return true
  if (/^\s*[\w.-]+\s*:\s*/.test(line)) return true
  if (/^\s*-\s+/.test(line)) return true
  if (/^\s{2,}\S/.test(line)) return true
  return false
}

function innerLooksLikeYamlBlock(inner: string[]): boolean {
  if (inner.length === 0) return true
  const nonBlank = inner.filter((l) => l.trim().length > 0)
  if (nonBlank.length === 0) return true
  const hasKeyOrList = nonBlank.some(
    (ln) => /^\s*[\w.-]+\s*:\s*/.test(ln) || /^\s*-\s+/.test(ln)
  )
  if (!hasKeyOrList) return false
  return inner.every((ln) => isYamlishLine(ln))
}

export function stripMarkdownFrontmatter(markdown: string): string {
  const src = markdown ?? ''
  if (!src.length) return src

  const lines = src.split(/\r?\n/)
  const firstLine = (lines[0] ?? '').replace(/^\uFEFF/, '')
  if (!isFenceLine(firstLine)) return src

  const scanEnd = Math.min(lines.length, 1 + MAX_FRONTMATTER_LINES)
  for (let i = 1; i < scanEnd; i++) {
    if (!isFenceLine(lines[i] ?? '')) continue
    const inner = lines.slice(1, i)
    if (!innerLooksLikeYamlBlock(inner)) continue
    const body = lines.slice(i + 1).join('\n')
    return body.replace(/^\n+/, '')
  }

  return src
}
