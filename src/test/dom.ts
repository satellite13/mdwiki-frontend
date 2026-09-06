import { DOMWrapper } from '@vue/test-utils'

export function getDocumentByTestId(testId: string): DOMWrapper<Element> {
  const elements = document.querySelectorAll(`[data-testid="${testId}"]`)
  const element = elements.item(elements.length - 1)
  if (!element) throw new Error(`Unable to find [data-testid="${testId}"] in document`)
  return new DOMWrapper(element)
}
