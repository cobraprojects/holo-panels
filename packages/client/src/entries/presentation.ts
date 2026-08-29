import type { ActionReadOnlyEntryManifest, ActionReadOnlyPresentationManifest, JsonObject, JsonValue, SchemaLayoutProperties, SchemaRenderSlots } from '@holo-js/panels-core'
import type { EntryClientManifest, EntryClientObject } from './contracts'
import { EntryStateStore } from './store'

function object(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function strings(value: JsonValue | undefined): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function objects(value: JsonValue | undefined): readonly EntryClientObject[] {
  return Array.isArray(value) ? value.filter(object) : []
}

function entryManifest(entry: ActionReadOnlyEntryManifest): EntryClientManifest {
  const properties = object(entry.properties) ? entry.properties : {}
  return {
    actions: strings(entry.actions),
    copyable: entry.copyable === true,
    defaultValue: entry.defaultValue ?? null,
    extraAttributes: object(entry.extraAttributes) ? entry.extraAttributes : {},
    formatters: objects(properties.formats),
    inlineLabel: entry.inlineLabel === true,
    label: typeof entry.label === 'string' ? entry.label : null,
    layout: entry.layout as SchemaLayoutProperties,
    path: typeof entry.path === 'string' ? entry.path : null,
    placeholder: typeof entry.placeholder === 'string' ? entry.placeholder : null,
    properties,
    slots: entry.slots as SchemaRenderSlots,
    type: typeof entry.type === 'string' ? entry.type : 'text',
    visible: entry.visible !== false,
  }
}

export function readOnlyPresentationStores(presentation: ActionReadOnlyPresentationManifest | null | undefined): readonly EntryStateStore[] {
  if (!presentation) return []
  if (presentation.kind !== 'infolist' || !Array.isArray(presentation.entries)) throw new TypeError('[Holo Panels] Invalid read-only presentation.')
  return Object.freeze(presentation.entries.map((value) => {
    if (!object(value) || typeof value.id !== 'string' || typeof value.type !== 'string') throw new TypeError('[Holo Panels] Invalid read-only presentation entry.')
    try {
      return new EntryStateStore(value.id, entryManifest(value))
    } catch {
      throw new TypeError('[Holo Panels] Invalid read-only presentation entry.')
    }
  }))
}
