import { toJsonValue } from '../../protocol/serialization'
import type { JsonValue } from '../../protocol/json'
import type {
  EntryRecordPath,
  EntryRecordPathValue,
  EntryResolver,
  EntryResolverContext,
  EntryStateSource,
} from './types'

function pathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') return undefined
    if (Array.isArray(current) && /^\d+$/u.test(segment)) return current[Number(segment)]
    return Object.prototype.hasOwnProperty.call(current, segment)
      ? (current as Readonly<Record<string, unknown>>)[segment]
      : undefined
  }, value)
}

function relationTitle(value: unknown, titlePath: string): unknown {
  if (Array.isArray(value)) return value.map(item => pathValue(item, titlePath))
  return pathValue(value, titlePath)
}

export function resolveEntrySource<TRecord>(record: Readonly<TRecord>, source: EntryStateSource): unknown {
  if (source.kind === 'computed') return undefined
  const value = pathValue(record, source.path)
  if (source.kind === 'relationship') return relationTitle(value, source.titlePath)
  return value
}

export async function resolveEntry<TRecord, TValue>(
  definition: {
    readonly manifest: {
      readonly defaultValue: unknown
      readonly placeholder: string | null
      readonly source: EntryStateSource
    }
    readonly server: { readonly state?: unknown }
  },
  record: Readonly<TRecord>,
  locale: string,
): Promise<JsonValue> {
  const sourceValue = resolveEntrySource(record, definition.manifest.source) as TValue
  const context: EntryResolverContext<TRecord, TValue> = { locale, record, value: sourceValue }
  const stateResolver = typeof definition.server.state === 'function'
    ? definition.server.state as EntryResolver<TRecord, TValue, unknown>
    : undefined
  const resolved = stateResolver ? await stateResolver(context) : sourceValue
  const fallback = resolved ?? definition.manifest.defaultValue ?? definition.manifest.placeholder
  return toJsonValue(fallback)
}

export function entryValueAt<
  TRecord,
  const TPath extends EntryRecordPath<TRecord>,
>(record: Readonly<TRecord>, path: TPath): EntryRecordPathValue<TRecord, TPath> {
  return pathValue(record, path) as EntryRecordPathValue<TRecord, TPath>
}
