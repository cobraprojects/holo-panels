import type { JsonObject, SchemaComponentKind, SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-core'
import type { FormOperation } from './types'

const schemaKinds = new Set<SchemaComponentKind>(['callout', 'custom', 'empty-state', 'entry', 'field', 'fieldset', 'filter', 'grid', 'group', 'section', 'split', 'step', 'tab', 'tabs', 'widget', 'wizard'])

function objectValue(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function isSchemaComponent(value: unknown): value is SchemaComponentManifest {
  const component = objectValue(value)
  const kind = component?.kind
  return !!component
    && typeof component.id === 'string'
    && typeof component.key === 'string'
    && typeof component.type === 'string'
    && typeof component.visible === 'boolean'
    && typeof component.dynamicVisibility === 'boolean'
    && typeof kind === 'string'
    && schemaKinds.has(kind as SchemaComponentKind)
    && Array.isArray(component.children)
    && component.children.every(isSchemaComponent)
    && !!objectValue(component.extraAttributes)
    && !!objectValue(component.layout)
    && !!objectValue(component.properties)
    && !!objectValue(component.slots)
    && (typeof component.statePath === 'undefined' || typeof component.statePath === 'string')
}

function isSchemaManifest<TValues extends object>(value: unknown): value is SchemaManifest<TValues> {
  const schema = objectValue(value)
  return !!schema && schema.kind === 'schema' && typeof schema.id === 'string' && Array.isArray(schema.components) && schema.components.every(isSchemaComponent)
}

export function decodeSchemaManifest<TValues extends object>(value: unknown): SchemaManifest<TValues> | null {
  return isSchemaManifest<TValues>(value) ? value : null
}

export function decodeFormOperationPaths(value: unknown): ReadonlySet<string> | null {
  if (!Array.isArray(value) || value.some(path => typeof path !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/u.test(path))) return null
  return new Set(value)
}

export function decodeFormSetOperations(value: unknown, allowedPaths: ReadonlySet<string>): readonly FormOperation[] | null {
  if (!Array.isArray(value)) return null
  const operations: FormOperation[] = []
  for (const candidate of value) {
    const operation = objectValue(candidate)
    if (!operation || operation.kind !== 'set' || typeof operation.path !== 'string' || !allowedPaths.has(operation.path) || !Object.hasOwn(operation, 'value')) return null
    operations.push({ kind: 'set', path: operation.path, value: operation.value })
  }
  return Object.freeze(operations)
}
