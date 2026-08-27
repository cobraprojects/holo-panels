import { field as holoField, schema, type FieldDefinition, type FieldRule } from '@holo-js/forms/schema'
import type { FieldClientHints } from './base/types'

export interface FormValidationField {
  readonly path: string
  readonly type: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly visible?: boolean
  readonly clientHints?: FieldClientHints
  readonly rules?: readonly string[]
  readonly properties?: Readonly<Record<string, unknown>>
}

export function formValidationFields(schema: object | null | undefined): readonly FormValidationField[] {
  if (!schema) return []
  const path = Reflect.get(schema, 'path')
  const type = Reflect.get(schema, 'type')
  if (typeof path === 'string' && typeof type === 'string') {
    const properties = Reflect.get(schema, 'properties')
    const rules = Reflect.get(schema, 'rules')
    return [{
      path, type,
      required: Reflect.get(schema, 'required') === true,
      disabled: Reflect.get(schema, 'disabled') === true,
      readOnly: Reflect.get(schema, 'readOnly') === true,
      visible: Reflect.get(schema, 'visible') !== false && Reflect.get(schema, 'hidden') !== true,
      properties: properties && typeof properties === 'object' && !Array.isArray(properties) ? properties : {},
      clientHints: readClientHints(Reflect.get(schema, 'clientHints')),
      rules: Array.isArray(rules) ? rules.filter((rule): rule is string => typeof rule === 'string') : [],
    }]
  }
  const fields = ['fields', 'components', 'children'].flatMap(key => {
    const nodes = Reflect.get(schema, key)
    return Array.isArray(nodes) ? nodes.flatMap(node => node && typeof node === 'object' ? formValidationFields(node) : []) : []
  })
  for (const key of ['manifest', 'properties', 'customProperties', 'actionField']) {
    const value = Reflect.get(schema, key)
    if (value && typeof value === 'object' && !Array.isArray(value)) fields.push(...formValidationFields(value))
  }
  return fields
}

function readClientHints(value: unknown): FieldClientHints | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const kind = (['string', 'number', 'boolean', 'date', 'file', 'array'] as const).find(kind => kind === Reflect.get(value, 'kind'))
  if (!kind) return undefined
  const format = Reflect.get(value, 'format')
  const allowedValues: unknown = Reflect.get(value, 'allowedValues')
  return {
    kind,
    required: Reflect.get(value, 'required') === true,
    nullable: Reflect.get(value, 'nullable') === true,
    ...Object.fromEntries(['minimum', 'maximum', 'exactSize'].flatMap(key => {
      const limit: unknown = Reflect.get(value, key)
      return typeof limit === 'number' && Number.isFinite(limit) ? [[key, limit]] : []
    })),
    ...(format === 'email' || format === 'url' ? { format } : {}),
    ...(Array.isArray(allowedValues) && allowedValues.every((item): item is boolean | number | string | null => item === null || typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number') ? { allowedValues } : {}),
  }
}

function validationDefinition(field: FormValidationField, value: unknown): FieldDefinition {
  const properties = field.properties ?? {}
  const hints = field.clientHints ?? readClientHints(properties.validationHints)
  const mode = properties.inputMode
  const type = field.type.split(':').at(-1) ?? field.type
  const choice = ['select', 'radio', 'toggle-buttons', 'hidden'].includes(type)
  const fallbackKind = mode === 'numeric' || mode === 'number' || type === 'number' || type === 'slider' || choice && typeof value === 'number'
    ? 'number'
    : ['checkbox', 'toggle', 'boolean'].includes(type) || choice && typeof value === 'boolean' ? 'boolean'
      : ['tags', 'repeater', 'builder', 'multiselect', 'checkbox-list'].includes(type) || properties.multiple === true ? 'array' : 'string'
  const kind = hints?.kind ?? fallbackKind
  const rules: FieldRule[] = [{ name: field.required || hints?.required ? 'required' : 'optional', args: [] }]
  if (hints?.nullable) rules.push({ name: 'nullable', args: [] })
  if (hints?.format) rules.push({ name: hints.format, args: [] })
  else if (mode === 'email' || mode === 'url') rules.push({ name: mode, args: [] })
  if (hints?.allowedValues) rules.push({ name: 'in', args: hints.allowedValues })
  for (const [property, name] of [['minimum', 'min'], ['maximum', 'max'], ['exactSize', 'size']] as const) {
    if (typeof hints?.[property] === 'number') rules.push({ name, args: [hints[property]] })
  }
  for (const [property, name] of [['minimumLength', 'min'], ['maximumLength', 'max'], ['minimum', 'min'], ['maximum', 'max']] as const) {
    if (typeof properties[property] === 'number') rules.push({ name, args: [properties[property]] })
  }
  const validationRules = field.rules ?? (Array.isArray(properties.validationRules) ? properties.validationRules.filter((rule): rule is string => typeof rule === 'string') : [])
  for (const rule of validationRules) {
    const [name, argument] = rule.split(':')
    if (name === 'required' || name === 'email' || name === 'url' || name === 'integer') rules.push({ name, args: [] })
    const numeric = Number(argument)
    if (argument !== undefined && Number.isFinite(numeric)) {
      if (name === 'min-length' || name === 'min-value') rules.push({ name: 'min', args: [numeric] })
      if (name === 'max-length' || name === 'max-value') rules.push({ name: 'max', args: [numeric] })
      if (name === 'length') rules.push({ name: 'size', args: [numeric] })
    }
  }
  return { kind, rules }
}

function fieldValue(values: object, path: string): unknown {
  let value: unknown = values
  for (const segment of path.split('.')) {
    if (!/^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)$/.test(segment) || ['__proto__', 'constructor', 'prototype'].includes(segment)) throw new Error('Invalid form validation path')
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, segment)) return undefined
    value = Reflect.get(value, segment)
  }
  return value
}

export async function validateFormFields(fields: readonly FormValidationField[], values: object): Promise<Readonly<Record<string, readonly string[]>>> {
  const entries = await Promise.all(fields.map(async field => {
    if (field.visible === false || field.disabled || field.readOnly) return []
    const value = fieldValue(values, field.path)
    const validation = validationDefinition(field, value)
    const errors = requiresPresenceValidation(field, value)
      ? await validateFieldPresence(validation.rules.some(rule => rule.name === 'required'), value)
      : (await schema({ value: { kind: 'field', definition: validation } })['~standard'].validate({ value })).issues?.map(issue => issue.message) ?? []
    return errors.length ? [[field.path, errors] as const] : []
  }))
  return Object.freeze(Object.fromEntries(entries.flat()))
}

function requiresPresenceValidation(field: FormValidationField, value: unknown): boolean {
  const type = field.type.split(':').at(-1) ?? field.type
  const object = value !== null && typeof value === 'object' && !Array.isArray(value) && !(typeof Blob !== 'undefined' && value instanceof Blob)
  if (type === 'upload' || type === 'file') return object || value === null || value === undefined
  const hints = field.clientHints ?? readClientHints(field.properties?.validationHints)
  return !hints && object && ['key-value', 'rich-editor', 'custom'].includes(type)
}

async function validateFieldPresence(required: boolean, value: unknown): Promise<readonly string[]> {
  const present = value !== undefined && value !== null && value !== ''
  const result = await schema({ present: holoField.boolean().custom(present => !required || present, 'This field is required.') })['~standard'].validate({ present })
  return result.issues?.map(issue => issue.message) ?? []
}
