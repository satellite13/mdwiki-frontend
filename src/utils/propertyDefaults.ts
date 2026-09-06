import type { PropertyDefinition, PropertyType } from '@/types'

/** Значение по умолчанию для вставки типизированного поля в YAML frontmatter. */
export function defaultPropertyYamlValue(definition: Pick<PropertyDefinition, 'type' | 'config'>): string {
  const type = definition.type as PropertyType
  switch (type) {
    case 'BOOLEAN':
      return 'false'
    case 'NUMBER':
      return '0'
    case 'DATE': {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    case 'DATETIME':
      return JSON.stringify(new Date().toISOString())
    case 'MULTI_SELECT':
      return '[]'
    case 'SELECT': {
      const options = Array.isArray(definition.config.options)
        ? definition.config.options.filter((item): item is string => typeof item === 'string')
        : []
      return options[0] != null ? JSON.stringify(options[0]) : '""'
    }
    case 'URL':
    case 'PAGE_REF':
    case 'TEXT':
    default:
      return '""'
  }
}
