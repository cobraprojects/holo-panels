import type { FormState, JsonObject, JsonValue, OptionValue } from '@holo-js/panels-client'
import type { SvelteFieldDefinition, SvelteFormStore } from './contracts'

export interface FieldPresentation {
  readonly disabled: boolean
  readonly errors: readonly string[]
  readonly readOnly: boolean
  readonly required: boolean
  readonly visible: boolean
}

export function fieldInputId(path: string): string {
  return `hp-field-${path.replace(/[^a-zA-Z0-9_-]/gu, '-')}`
}

export function readFieldValue(values: Record<string, unknown>, path: string): unknown {
  let current: unknown = values
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export function writeFieldValue(form: SvelteFormStore, path: string, value: unknown): void {
  form.batch([{ kind: 'set', path, touch: true, value }])
}

export function fieldPresentation(
  definition: SvelteFieldDefinition,
  state: FormState<Record<string, unknown>>,
): FieldPresentation {
  return {
    disabled: Boolean(definition.disabled || state.disabled[definition.path]),
    errors: state.errors[definition.path] ?? [],
    readOnly: Boolean(definition.readOnly || state.readOnly[definition.path]),
    required: Boolean(definition.required),
    visible: definition.visible !== false && state.visibility[definition.path] !== false,
  }
}

export function fieldProperties(definition: SvelteFieldDefinition): JsonObject {
  return definition.properties ?? {}
}

export function stringProperty(properties: JsonObject, key: string): string | undefined {
  const value = properties[key]
  return typeof value === 'string' ? value : undefined
}

export function booleanProperty(properties: JsonObject, key: string, fallback = false): boolean {
  const value = properties[key]
  return typeof value === 'boolean' ? value : fallback
}

export function numberProperty(properties: JsonObject, key: string): number | undefined {
  const value = properties[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function optionValue(raw: string, options: readonly { readonly value: OptionValue }[]): OptionValue {
  return options.find(option => String(option.value) === raw)?.value ?? raw
}

export function jsonValue(value: unknown, fallback: JsonValue = ''): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(item => jsonValue(item))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
  }
  return fallback
}
