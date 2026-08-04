import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'

export interface RenderSlotReference {
  readonly component: string
  readonly order?: number
  readonly properties?: JsonObject
}

export type PanelRenderSlot =
  | 'body-end'
  | 'body-start'
  | 'content-after'
  | 'content-before'
  | 'footer'
  | 'head-end'
  | 'head-start'
  | 'navigation-after'
  | 'navigation-before'
  | 'sidebar-after'
  | 'sidebar-before'
  | 'topbar-after'
  | 'topbar-before'
  | 'user-menu-after'
  | 'user-menu-before'

export type ResourceRenderSlot =
  | 'form-after'
  | 'form-before'
  | 'infolist-after'
  | 'infolist-before'
  | 'table-after'
  | 'table-before'

export type RenderSlotSource = 'application' | 'panel' | 'plugin' | 'resource' | 'page' | 'component'

const sourceOrder: Readonly<Record<RenderSlotSource, number>> = Object.freeze({
  application: 0,
  plugin: 1,
  panel: 2,
  resource: 3,
  page: 4,
  component: 5,
})

export interface ScopedRenderSlotManifest extends JsonObject {
  readonly component: string
  readonly order: number
  readonly properties: JsonObject
  readonly source: RenderSlotSource
}

export type ScopedRenderSlots<TSlot extends string> = Readonly<Partial<Record<TSlot, readonly ScopedRenderSlotManifest[]>>>

const componentPattern = /^[A-Za-z][A-Za-z0-9]*(?:[._:-][A-Za-z0-9]+)*$/u

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function normalizeProperties(value: JsonObject | undefined): JsonObject {
  const serialized = toJsonValue(value ?? {})
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new TypeError('Render slot properties must be a JSON-safe object')
  }
  return Object.freeze(serialized)
}

export function appendScopedRenderSlot<TSlot extends string>(
  slots: ScopedRenderSlots<TSlot>,
  slot: TSlot,
  reference: string | RenderSlotReference,
  source: RenderSlotSource,
): ScopedRenderSlots<TSlot> {
  if (!Object.hasOwn(sourceOrder, source)) throw new Error('Render slots require a valid registration source')
  const component = (typeof reference === 'string' ? reference : reference.component).trim()
  if (!componentPattern.test(component)) throw new Error('Render slots require a named registered component')
  const order = typeof reference === 'string' ? 0 : (reference.order ?? 0)
  if (!Number.isSafeInteger(order)) throw new Error('Render slot order must be a safe integer')
  const properties = normalizeProperties(typeof reference === 'string' ? undefined : reference.properties)
  const manifest: ScopedRenderSlotManifest = Object.freeze({ component, order, properties, source })
  const existing = slots[slot] ?? []
  const duplicate = existing.some(item => (
    item.component === component
    && item.order === order
    && item.source === source
    && canonicalJson(item.properties) === canonicalJson(properties)
  ))
  if (duplicate) throw new Error(`Duplicate render slot component "${component}" for "${slot}"`)
  const ordered = [...existing, manifest].sort((left, right) => (
    left.order - right.order
    || sourceOrder[left.source] - sourceOrder[right.source]
    || left.component.localeCompare(right.component)
    || canonicalJson(left.properties).localeCompare(canonicalJson(right.properties))
  ))
  return Object.freeze({ ...slots, [slot]: Object.freeze(ordered) })
}
