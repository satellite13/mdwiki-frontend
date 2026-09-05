export type DiffRow = {
  kind: 'context' | 'add' | 'remove'
  before: string | null
  after: string | null
}

export function diffRows(before: string, after: string): { rows: DiffRow[]; truncated: boolean } {
  const left = before.split('\n')
  const right = after.split('\n')
  if (left.length > 5_000 || right.length > 5_000 || left.length * right.length > 1_000_000) {
    let prefix = 0
    while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++
    let suffix = 0
    while (
      suffix < left.length - prefix &&
      suffix < right.length - prefix &&
      left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
    ) suffix++
    const context = 20
    const changeBudget = 20
    const rows: DiffRow[] = []
    const marker = () => rows.push({ kind: 'context', before: '…', after: '…' })
    const prefixStart = Math.max(0, prefix - context)
    if (prefixStart > 0) marker()
    for (let i = prefixStart; i < prefix; i++) {
      rows.push({ kind: 'context', before: left[i]!, after: right[i]! })
    }
    const leftChangeEnd = left.length - suffix
    const rightChangeEnd = right.length - suffix
    for (let i = prefix; i < Math.min(leftChangeEnd, prefix + changeBudget); i++) {
      rows.push({ kind: 'remove', before: left[i]!, after: null })
    }
    for (let i = prefix; i < Math.min(rightChangeEnd, prefix + changeBudget); i++) {
      rows.push({ kind: 'add', before: null, after: right[i]! })
    }
    if (leftChangeEnd - prefix > changeBudget || rightChangeEnd - prefix > changeBudget) marker()
    const suffixCount = Math.min(suffix, context)
    for (let offset = suffixCount; offset > 0; offset--) {
      rows.push({
        kind: 'context',
        before: left[left.length - offset]!,
        after: right[right.length - offset]!,
      })
    }
    if (suffix > context) marker()
    return {
      truncated: true,
      rows,
    }
  }
  const lengths = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i]![j] = left[i] === right[j]
        ? lengths[i + 1]![j + 1]! + 1
        : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }
  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      rows.push({ kind: 'context', before: left[i]!, after: right[j]! }); i++; j++
    } else if (i < left.length && j < right.length && lengths[i + 1]![j] === lengths[i]![j + 1]) {
      rows.push({ kind: 'remove', before: left[i++]!, after: null })
      rows.push({ kind: 'add', before: null, after: right[j++]! })
    } else if (j < right.length && (i === left.length || lengths[i]![j + 1]! >= lengths[i + 1]![j]!)) {
      rows.push({ kind: 'add', before: null, after: right[j++]! })
    } else {
      rows.push({ kind: 'remove', before: left[i++]!, after: null })
    }
  }
  return { rows, truncated: false }
}
