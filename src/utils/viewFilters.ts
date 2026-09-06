import type {
  PropertyType,
  ViewFilterCondition,
  ViewFilterMode,
  ViewFilterOperator,
} from '@/types'

export type ViewFilterOp = ViewFilterOperator

export type ViewFilterDraft = {
  key: string
  op: ViewFilterOp
  value: string
}

export type ViewFilterAst = ViewFilterCondition

const OPS_BY_TYPE: Record<PropertyType, ViewFilterOp[]> = {
  TEXT: ['EQ', 'NEQ', 'CONTAINS', 'EXISTS'],
  URL: ['EQ', 'NEQ', 'CONTAINS', 'EXISTS'],
  NUMBER: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS'],
  DATE: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS'],
  DATETIME: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS'],
  BOOLEAN: ['EQ', 'NEQ', 'EXISTS'],
  SELECT: ['EQ', 'NEQ', 'CONTAINS', 'EXISTS'],
  MULTI_SELECT: ['CONTAINS', 'EXISTS'],
  PAGE_REF: ['EQ', 'NEQ', 'EXISTS'],
}

export function operatorsForPropertyType(type: PropertyType): ViewFilterOp[] {
  return OPS_BY_TYPE[type] ?? ['EQ', 'EXISTS']
}

export function defaultOperatorForType(type: PropertyType): ViewFilterOp {
  const ops = operatorsForPropertyType(type)
  return ops.includes('EQ') ? 'EQ' : ops[0]!
}

export function createEmptyViewFilterDraft(): ViewFilterDraft {
  return { key: '', op: 'EQ', value: '' }
}

export function coerceFilterValue(
  type: PropertyType,
  op: ViewFilterOp,
  raw: string
): string | number | boolean | undefined {
  if (op === 'EXISTS') return undefined
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('value-required')
  if (type === 'NUMBER') {
    const n = Number(trimmed)
    if (!Number.isFinite(n)) throw new Error('invalid-number')
    return n
  }
  if (type === 'BOOLEAN') {
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
    throw new Error('invalid-boolean')
  }
  return trimmed
}

export function buildViewFilters(
  drafts: ViewFilterDraft[],
  typeByKey: Record<string, PropertyType>
): ViewFilterAst[] {
  return drafts
    .filter((draft) => draft.key)
    .map((draft) => {
      const type = typeByKey[draft.key]
      if (!type) throw new Error(`unknown-property:${draft.key}`)
      const allowed = operatorsForPropertyType(type)
      if (!allowed.includes(draft.op)) throw new Error(`invalid-op:${draft.op}`)
      if (draft.op === 'EXISTS') return { key: draft.key, op: draft.op }
      return {
        key: draft.key,
        op: draft.op,
        value: coerceFilterValue(type, draft.op, draft.value),
      }
    })
}

export function selectOptionsFromConfig(config: Record<string, unknown>): string[] {
  const options = config.options
  if (!Array.isArray(options)) return []
  return options.map((item) => String(item)).filter(Boolean)
}

export type ViewFilterSummaryLabels = {
  noFilter: string
  allConnector: string
  anyConnector: string
  property: (key: string) => string
  operator: (op: string) => string
}

export function formatViewFilterSummary(
  filters: ViewFilterCondition[],
  mode: ViewFilterMode,
  labels: ViewFilterSummaryLabels,
): string {
  if (!filters.length) return labels.noFilter
  const parts = filters.map((filter) => {
    const property = labels.property(filter.key)
    const operator = labels.operator(filter.op)
    if (filter.op === 'EXISTS') return `${property} · ${operator}`
    return `${property} ${operator} ${String(filter.value ?? '')}`
  })
  return parts.join(` ${mode === 'ANY' ? labels.anyConnector : labels.allConnector} `)
}

export function draftsFromSavedFilters(
  filters: unknown[],
  typeByKey: Record<string, PropertyType>,
): ViewFilterDraft[] {
  const drafts: ViewFilterDraft[] = []
  for (const candidate of filters) {
    if (!candidate || typeof candidate !== 'object') continue
    const filter = candidate as Record<string, unknown>
    if (typeof filter.key !== 'string' || typeof filter.op !== 'string') continue
    const type = typeByKey[filter.key]
    if (!type) continue
    const op = filter.op as ViewFilterOp
    if (!operatorsForPropertyType(type).includes(op)) continue
    if (op !== 'EXISTS' && !['string', 'number', 'boolean'].includes(typeof filter.value)) continue
    drafts.push({
      key: filter.key,
      op,
      value: op === 'EXISTS' ? '' : String(filter.value),
    })
  }
  return drafts.length ? drafts : [createEmptyViewFilterDraft()]
}
