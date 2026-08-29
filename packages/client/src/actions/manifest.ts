import type { ActionManifest, ActionReadOnlyEntryManifest, ActionReadOnlyPresentationManifest, JsonObject, JsonValue, SchemaLayoutProperties, SchemaRenderSlots, ScopedRenderSlotManifest } from '@holo-js/panels-core'

const breakpoints = new Set(['default', 'sm', 'md', 'lg', 'xl', '2xl'])
const entrySlots = new Set(['above', 'after', 'before', 'below'])
const slotSources = new Set(['application', 'component', 'panel', 'plugin'])

function object(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nullableStrings(value: JsonObject, keys: readonly string[]): boolean {
  return keys.every(key => value[key] === null || typeof value[key] === 'string')
}

function responsive(value: JsonValue | undefined, allowFull: boolean, positive: boolean): boolean {
  return value === undefined || object(value) && Object.entries(value).every(([key, item]) => breakpoints.has(key)
    && (allowFull && item === 'full' || typeof item === 'number' && Number.isSafeInteger(item) && (!positive || item > 0)))
}

function entryLayout(value: JsonValue | undefined): value is JsonObject & SchemaLayoutProperties {
  return object(value)
    && Object.keys(value).every(key => ['columns', 'columnSpan', 'columnStart', 'order'].includes(key))
    && responsive(value.columns, false, true)
    && responsive(value.columnSpan, true, true)
    && responsive(value.columnStart, false, true)
    && responsive(value.order, false, false)
}

function scopedSlot(value: JsonValue): value is JsonObject & ScopedRenderSlotManifest {
  return object(value)
    && typeof value.component === 'string'
    && typeof value.order === 'number'
    && Number.isSafeInteger(value.order)
    && object(value.properties)
    && typeof value.source === 'string'
    && slotSources.has(value.source)
}

function renderSlots(value: JsonValue | undefined): value is JsonObject & SchemaRenderSlots {
  return object(value) && Object.entries(value).every(([key, entries]) => entrySlots.has(key) && Array.isArray(entries) && entries.every(scopedSlot))
}

function readOnlyEntry(value: JsonValue): value is JsonObject & ActionReadOnlyEntryManifest {
  if (!object(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return false
  return Array.isArray(value.actions) && value.actions.every(action => typeof action === 'string')
    && ['copyable', 'inlineLabel', 'visible'].every(key => typeof value[key] === 'boolean')
    && ['label', 'path', 'placeholder', 'tooltip', 'url'].every(key => value[key] === null || typeof value[key] === 'string')
    && ['extraAttributes', 'properties'].every(key => object(value[key]))
    && entryLayout(value.layout)
    && renderSlots(value.slots)
    && Object.hasOwn(value, 'defaultValue')
}

function readOnlyPresentation(value: JsonValue | undefined): value is (JsonObject & ActionReadOnlyPresentationManifest) | null | undefined {
  return value === undefined || value === null || object(value)
    && value.kind === 'infolist'
    && Array.isArray(value.entries)
    && value.entries.every(readOnlyEntry)
}

function modal(value: JsonValue | undefined): boolean {
  if (value === null) return true
  if (!object(value)) return false
  return typeof value.alignment === 'string' && ['center', 'end', 'start'].includes(value.alignment)
    && typeof value.width === 'string' && ['small', 'medium', 'large', 'extra-large', 'screen'].includes(value.width)
    && ['autofocus', 'closeByClickingAway', 'closeByEscaping', 'slideOver', 'stickyFooter', 'stickyHeader'].every(key => typeof value[key] === 'boolean')
    && nullableStrings(value, ['cancelActionLabel', 'description', 'heading', 'icon', 'iconColor', 'submitActionLabel'])
    && ['content', 'footer', 'schema'].every(key => value[key] === undefined || value[key] === null || object(value[key]))
    && readOnlyPresentation(value.readOnlyPresentation)
    && Array.isArray(value.nestedActions) && value.nestedActions.every(id => typeof id === 'string')
}

export function isActionManifest(value: JsonValue | undefined, id: string): value is JsonObject & ActionManifest {
  return object(value) && value.id === id && typeof value.mount === 'string' && ['page', 'record', 'bulk', 'modal', 'notification'].includes(value.mount)
    && typeof value.label === 'string' && value.label.length > 0 && value.label.length <= 200
    && typeof value.type === 'string'
    && typeof value.kind === 'string' && ['associate', 'attach', 'create', 'custom', 'delete', 'detach', 'dissociate', 'edit', 'editPivot', 'force-delete', 'replicate', 'restore', 'view'].includes(value.kind)
    && typeof value.size === 'string' && ['extra-small', 'small', 'medium', 'large', 'extra-large'].includes(value.size)
    && typeof value.visible === 'boolean' && typeof value.disabled === 'boolean'
    && nullableStrings(value, ['badge', 'color', 'confirmation', 'icon', 'tooltip'])
    && modal(value.modal)
}

export function actionManifestCollection(actions: readonly ActionManifest[], depth = 0): readonly ActionManifest[] {
  if (depth > 10) throw new Error('Nested actions cannot exceed ten levels')
  return actions.flatMap(action => [action, ...actionManifestCollection(action.modal?.actions ?? [], depth + 1)])
}
