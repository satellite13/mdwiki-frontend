import type { Annotation } from '@/types'

/** Группирует аннотации по highlightedText, сохраняя порядок первого появления; пустой текст пропускается. */
export function groupAnnotationsByText(annotations: Annotation[]): Array<{ text: string; ids: string[] }> {
  const groups: Array<{ text: string; ids: string[] }> = []
  for (const annotation of annotations) {
    const text = annotation.highlightedText
    if (!text) continue
    const group = groups.find((g) => g.text === text)
    if (group) {
      group.ids.push(annotation.id)
    } else {
      groups.push({ text, ids: [annotation.id] })
    }
  }
  return groups
}
