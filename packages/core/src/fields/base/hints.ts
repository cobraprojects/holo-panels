import type { FieldDefinition, FieldRule } from '@holo-js/forms'
import type { JsonValue } from '../../protocol/json'
import type { FieldClientHints } from './types'

function findRule(definition: FieldDefinition, name: FieldRule['name']): FieldRule | undefined {
  return definition.rules.find(rule => rule.name === name)
}

function numericRuleArgument(rule: FieldRule | undefined): number | undefined {
  const value = rule?.args[0]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function allowedValues(rule: FieldRule | undefined): readonly JsonValue[] | undefined {
  if (!rule) return undefined
  const values = rule.args.filter((value): value is JsonValue => (
    value === null || ['boolean', 'number', 'string'].includes(typeof value)
  ))
  return values.length === rule.args.length ? Object.freeze(values) : undefined
}

export function deriveFieldClientHints(definition: FieldDefinition): FieldClientHints {
  const format = findRule(definition, 'email')
    ? 'email'
    : findRule(definition, 'url')
      ? 'url'
      : undefined
  return Object.freeze({
    kind: definition.kind,
    required: Boolean(findRule(definition, 'required')),
    nullable: Boolean(findRule(definition, 'nullable')),
    ...(typeof numericRuleArgument(findRule(definition, 'min')) === 'number'
      ? { minimum: numericRuleArgument(findRule(definition, 'min')) }
      : {}),
    ...(typeof numericRuleArgument(findRule(definition, 'max')) === 'number'
      ? { maximum: numericRuleArgument(findRule(definition, 'max')) }
      : {}),
    ...(typeof numericRuleArgument(findRule(definition, 'size')) === 'number'
      ? { exactSize: numericRuleArgument(findRule(definition, 'size')) }
      : {}),
    ...(format ? { format } : {}),
    ...(allowedValues(findRule(definition, 'in')) ? { allowedValues: allowedValues(findRule(definition, 'in')) } : {}),
  })
}

export function deriveSchemaDefault<TValue>(definition: FieldDefinition): TValue | undefined {
  return findRule(definition, 'default')?.args[0] as TValue | undefined
}
