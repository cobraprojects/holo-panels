import type { JsonObject } from '../../protocol/json'
import type { ExtensionTypeId } from '../../plugins/type-id'
import { CustomEntry } from './builtins'
import type { EntryRecordPath } from './types'

export type CustomEntryType = ExtensionTypeId<'entry'> | `${string}:entry:${string}`

export interface CustomEntryDefinition<TType extends CustomEntryType> {
  readonly configuration: JsonObject
  readonly type: TType
}

export function defineEntry<const TType extends CustomEntryType>(
  type: TType,
  configuration: JsonObject = {},
): CustomEntryDefinition<TType> {
  if (!/^[a-z][a-z0-9.-]*:entry:[a-z][a-z0-9._-]*$/u.test(type)) throw new Error('Custom entry type IDs must use namespace:entry:name')
  return Object.freeze({ configuration: Object.freeze({ ...configuration }), type })
}

export function customEntryFrom<
  TRecord,
  const TPath extends EntryRecordPath<TRecord>,
  const TType extends CustomEntryType,
>(definition: CustomEntryDefinition<TType>, path: TPath): CustomEntry<TRecord, unknown, TType> {
  return new CustomEntry(definition.type, path, definition.configuration)
}
