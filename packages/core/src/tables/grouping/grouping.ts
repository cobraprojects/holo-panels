import { deepFreeze } from '../../builders/deep-freeze'
import type { OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource } from '../../inference/type-source'
import type { JsonValue } from '../../protocol/json'
import type { RecordPath, RecordPathValue } from '../columns/types'
import type {
  CompiledGroupDefinition,
  GroupedRecords,
  GroupManifest,
  GroupOrder,
  GroupResolver,
  GroupStateSnapshot,
} from './types'
import { queryColumn, safeJson, stableId, valueAtPath } from './validation'

function defaultGroupTitle(value: JsonValue): string {
  if (value === null) return 'None'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function groupKey(value: JsonValue): string {
  return JSON.stringify(value)
}

function compareGroupValues(left: JsonValue, right: JsonValue): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return defaultGroupTitle(left).localeCompare(defaultGroupTitle(right))
}

export class GroupBuilder<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TContext = unknown,
> {
  readonly #id: string
  readonly #path: TPath
  readonly #column: string
  #label: string | null = null
  #collapsible = false
  #collapsed = false
  #order: GroupOrder = 'asc'
  #persistKey: string
  #title?: GroupResolver<TRecord, TPath, TContext>
  #description?: GroupResolver<TRecord, TPath, TContext>
  #compiled?: CompiledGroupDefinition<TRecord, TPath, TContext>

  constructor(id: string, path: TPath, column: string = path) {
    this.#id = stableId(id, 'group ID')
    this.#path = path
    this.#column = queryColumn(column, 'group column')
    this.#persistKey = `group-${id}`
  }

  label(value: string | null): this {
    this.assertMutable()
    if (value !== null && !value.trim()) throw new Error('Group labels cannot be empty')
    this.#label = value?.trim() ?? null
    return this
  }

  title(resolver: GroupResolver<TRecord, TPath, TContext>): this {
    this.assertMutable()
    this.#title = resolver
    return this
  }

  description(resolver: GroupResolver<TRecord, TPath, TContext>): this {
    this.assertMutable()
    this.#description = resolver
    return this
  }

  collapsible(value = true): this {
    this.assertMutable()
    this.#collapsible = value
    return this
  }

  collapsed(value = true): this {
    this.assertMutable()
    this.#collapsed = value
    return this
  }

  order(value: GroupOrder): this {
    this.assertMutable()
    this.#order = value
    return this
  }

  persistAs(key: string): this {
    this.assertMutable()
    this.#persistKey = stableId(key, 'group persistence key')
    return this
  }

  compile(): CompiledGroupDefinition<TRecord, TPath, TContext> {
    if (this.#compiled) return this.#compiled
    if (this.#collapsed && !this.#collapsible) throw new Error('Groups must be collapsible before starting collapsed')
    const manifest: GroupManifest<TPath> = {
      id: this.#id,
      path: this.#path,
      column: this.#column,
      label: this.#label,
      collapsible: this.#collapsible,
      collapsed: this.#collapsed,
      order: this.#order,
      persistKey: this.#persistKey,
    }
    const definition: CompiledGroupDefinition<TRecord, TPath, TContext> = {
      kind: 'group',
      manifest,
      server: {
        ...(this.#title ? { title: this.#title } : {}),
        ...(this.#description ? { description: this.#description } : {}),
      },
    }
    deepFreeze(definition)
    this.#compiled = definition
    return definition
  }

  private assertMutable(): void {
    if (this.#compiled) throw new Error('Cannot change a group after compilation')
  }
}

export class GroupingState {
  readonly #manifest: GroupManifest
  #order: GroupOrder
  #collapsed: Set<string>

  constructor(manifest: GroupManifest, snapshot?: Partial<GroupStateSnapshot>) {
    this.#manifest = manifest
    this.#order = snapshot?.order ?? manifest.order
    this.#collapsed = new Set(snapshot?.collapsed ?? [])
  }

  order(value: GroupOrder): this {
    this.#order = value
    return this
  }

  collapse(key: string): this {
    if (!this.#manifest.collapsible) throw new Error('This group is not collapsible')
    if (this.#manifest.collapsed) this.#collapsed.delete(`expanded:${key}`)
    else this.#collapsed.add(key)
    return this
  }

  expand(key: string): this {
    if (this.#manifest.collapsed) this.#collapsed.add(`expanded:${key}`)
    else this.#collapsed.delete(key)
    return this
  }

  toggle(key: string): this {
    return this.#collapsed.has(key) ? this.expand(key) : this.collapse(key)
  }

  isCollapsed(key: string): boolean {
    return this.#manifest.collapsed ? !this.#collapsed.has(`expanded:${key}`) : this.#collapsed.has(key)
  }

  snapshot(): GroupStateSnapshot {
    const snapshot: GroupStateSnapshot = {
      order: this.#order,
      collapsed: Object.freeze([...this.#collapsed].sort()),
    }
    deepFreeze(snapshot)
    return snapshot
  }

  toUrl(): string {
    const collapsed = [...this.#collapsed].sort().map(encodeURIComponent).join(',')
    return `${encodeURIComponent(this.#manifest.persistKey)}=${this.#order}${collapsed ? `:${collapsed}` : ''}`
  }

  static fromUrl(manifest: GroupManifest, value: string): GroupingState {
    if (value.length > 4_096) throw new Error('Grouping URL state is too long')
    const separator = value.indexOf('=')
    if (separator < 1 || decodeURIComponent(value.slice(0, separator)) !== manifest.persistKey) return new GroupingState(manifest)
    const payload = value.slice(separator + 1)
    const [order, collapsed = ''] = payload.split(':', 2)
    if (order !== 'asc' && order !== 'desc') throw new Error('Invalid grouping URL order')
    const keys = collapsed ? collapsed.split(',').map(decodeURIComponent) : []
    if (keys.length > 200 || keys.some(key => key.length > 512)) throw new Error('Grouping URL state exceeds safe limits')
    return new GroupingState(manifest, { order, collapsed: [...new Set(keys)].sort() })
  }
}

export async function groupPageRecords<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TContext = unknown,
>(
  records: readonly TRecord[],
  definition: CompiledGroupDefinition<TRecord, TPath, TContext>,
  context: TContext,
  state = new GroupingState(definition.manifest),
): Promise<readonly GroupedRecords<TRecord>[]> {
  const groups = new Map<string, { readonly value: JsonValue, readonly records: TRecord[] }>()
  for (const record of records) {
    const value = safeJson(valueAtPath(record, definition.manifest.path), 'Group value')
    const key = groupKey(value)
    const existing = groups.get(key)
    if (existing) existing.records.push(record)
    else groups.set(key, { value, records: [record] })
  }
  const direction = state.snapshot().order === 'asc' ? 1 : -1
  const ordered = [...groups.entries()].sort(([, left], [, right]) => compareGroupValues(left.value, right.value) * direction)
  return Promise.all(ordered.map(async ([key, group]) => {
    const resolverContext = {
      context,
      path: definition.manifest.path,
      value: group.value as RecordPathValue<TRecord, TPath>,
      records: group.records,
    }
    const title = definition.server.title
      ? await definition.server.title(resolverContext)
      : defaultGroupTitle(group.value)
    const description = definition.server.description
      ? await definition.server.description(resolverContext)
      : null
    return Object.freeze({
      key,
      value: group.value,
      title,
      description,
      collapsed: state.isCollapsed(key),
      records: Object.freeze([...group.records]),
    })
  }))
}

export function groupBy<TRecord, TPath extends RecordPath<TRecord>, TContext = unknown>(
  id: string,
  path: TPath,
  column: string = path,
): GroupBuilder<TRecord, TPath, TContext> {
  return new GroupBuilder(id, path, column)
}

export class GroupFactory<TRecord, TContext = unknown> {
  group<TPath extends RecordPath<TRecord>>(id: string, path: TPath, column: string = path): GroupBuilder<TRecord, TPath, TContext> {
    return new GroupBuilder(id, path, column)
  }
}

export function groupingsFor<
  TRecordSource extends RecordTypeSource,
  TContextSource extends RuntimeTypeSource | undefined = undefined,
>(
  _record: TRecordSource,
  _context?: TContextSource,
): GroupFactory<RecordTypeValue<TRecordSource>, OptionalRuntimeTypeValue<TContextSource>> {
  return new GroupFactory()
}
