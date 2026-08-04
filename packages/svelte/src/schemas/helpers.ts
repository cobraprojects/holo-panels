import type { JsonObject, JsonValue, SchemaComponentManifest, SchemaManifest } from '@holo-js/panels-client'
import type { SveltePanelComponent } from '../registry'
import type { SchemaRegisteredComponentProps, SchemaRendererContext } from './contracts'

const KINDS = new Set([
  'callout',
  'custom',
  'empty-state',
  'entry',
  'fieldset',
  'filter',
  'grid',
  'group',
  'section',
  'split',
  'step',
  'tab',
  'tabs',
  'widget',
  'wizard',
])

export function isSchemaManifest(value: JsonObject | null): value is JsonObject & SchemaManifest {
  return value?.kind === 'schema'
    && typeof value.id === 'string'
    && Array.isArray(value.components)
    && value.components.every(isSchemaComponentManifest)
}

export function safeDomAttributes(attributes: JsonObject): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const [name, value] of Object.entries(attributes)) {
    if (!isSafeAttributeName(name) || !isPrimitive(value)) continue
    safe[name] = String(value)
  }
  return safe
}

export function extraClass(attributes: JsonObject): string | undefined {
  return typeof attributes.class === 'string' && attributes.class.trim()
    ? attributes.class.trim()
    : undefined
}

export function layoutAttributes(component: SchemaComponentManifest): Record<string, string> {
  const attributes: Record<string, string> = {
    'data-schema-id': component.id,
    'data-schema-kind': component.kind,
  }
  for (const [name, value] of Object.entries(component.layout)) {
    if (value === undefined) continue
    attributes[`data-layout-${toKebabCase(name)}`] = stableJson(value)
  }
  if (component.dynamicVisibility) attributes['data-dynamic-visibility'] = 'true'
  if (component.statePath) attributes['data-state-path'] = component.statePath
  return attributes
}

export function componentClass(component: SchemaComponentManifest): string {
  return ['hp-schema-component', `hp-schema-${component.kind}`, extraClass(component.extraAttributes)]
    .filter((value): value is string => Boolean(value))
    .join(' ')
}

export function contentId(schemaId: string, componentId: string, suffix: string): string {
  return `hp-schema-${schemaId}-${componentId}-${suffix}`.replace(/[^a-z0-9_-]/giu, '-')
}

export function persistenceKey(schemaId: string, component: SchemaComponentManifest): string | null {
  const key = component.properties.collapse?.persistenceKey ?? component.properties.persistenceKey
  return key ? `holo-panels:${schemaId}:${key}` : null
}

export function resolveRegisteredComponent(
  context: SchemaRendererContext,
  typeId: string,
  requestedFrom: string,
): SveltePanelComponent<SchemaRegisteredComponentProps> {
  if (!context.registry) {
    throw new Error(`[Holo Panels] A Svelte component registry is required for "${typeId}". Requested from ${requestedFrom}.`)
  }
  return context.registry.resolve<SchemaRegisteredComponentProps>(typeId, context.panelId, requestedFrom)
}

export function isSchemaComponentManifest(value: JsonValue): value is JsonObject & SchemaComponentManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return typeof value.id === 'string'
    && typeof value.type === 'string'
    && typeof value.key === 'string'
    && typeof value.kind === 'string'
    && KINDS.has(value.kind)
    && typeof value.visible === 'boolean'
    && Array.isArray(value.children)
    && value.children.every(isSchemaComponentManifest)
    && isObject(value.layout)
    && isObject(value.extraAttributes)
    && isObject(value.properties)
    && isObject(value.slots)
}

function isSafeAttributeName(name: string): boolean {
  return /^(?:aria-[a-z][a-z0-9-]*|data-[a-z][a-z0-9-]*|dir|role|title)$/u.test(name)
}

function isPrimitive(value: JsonValue): value is boolean | number | string {
  return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stableJson(value: JsonValue): string {
  if (!value || typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return JSON.stringify(value)
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/gu, character => `-${character.toLowerCase()}`)
}
