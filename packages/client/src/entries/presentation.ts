import { toJsonValue, type ActionReadOnlyEntryManifest, type ActionReadOnlyPresentationManifest, type JsonObject, type JsonValue } from '@holo-js/panels-core'
import type { EntryClientManifest, EntryClientObject } from './contracts'
import { EntryStateStore } from './store'

function object(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function objects(value: JsonValue | undefined): readonly EntryClientObject[] {
  return Array.isArray(value) ? value.filter(object) : []
}

function entryManifest(entry: ActionReadOnlyEntryManifest): EntryClientManifest {
  const properties = object(entry.properties) ? entry.properties : {}
  return {
    actions: entry.actions,
    copyable: entry.copyable,
    defaultValue: toJsonValue(entry.defaultValue),
    extraAttributes: object(entry.extraAttributes) ? entry.extraAttributes : {},
    formatters: objects(properties.formats),
    inlineLabel: entry.inlineLabel,
    label: entry.label,
    layout: entry.layout,
    path: entry.path,
    placeholder: entry.placeholder,
    properties,
    slots: entry.slots,
    type: entry.type,
    visible: entry.visible,
  }
}

export function readOnlyPresentationStores(presentation: ActionReadOnlyPresentationManifest | null | undefined): readonly EntryStateStore[] {
  if (!presentation) return []
  if (presentation.kind !== 'infolist' || !Array.isArray(presentation.entries)) throw new TypeError('[Holo Panels] Invalid read-only presentation.')
  return Object.freeze(presentation.entries.map((value) => {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.type !== 'string') throw new TypeError('[Holo Panels] Invalid read-only presentation entry.')
    try {
      const store = new EntryStateStore(value.id, entryManifest(value))
      store.setResolved({ tooltip: value.tooltip, url: value.url, visible: value.visible })
      return store
    } catch {
      throw new TypeError('[Holo Panels] Invalid read-only presentation entry.')
    }
  }))
}
