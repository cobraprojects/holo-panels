import { createHash } from 'node:crypto'
import type { ExporterDefinition, ImporterDefinition } from './contracts'
import type { TableRecordIdentifier } from '../tables/query/contracts'

type RevisionableDefinition
  = { readonly id: string, readonly kind: 'import', readonly resourceId: string, readonly server: { readonly chunkSize: number, readonly columns: readonly { readonly key: string }[], readonly formats: readonly { readonly id: string }[], readonly limits: object, readonly queue: object, readonly retention: object, readonly storage: object } }
    | { readonly id: string, readonly kind: 'export', readonly resourceId: string, readonly server: { readonly chunkSize: number, readonly columns: readonly { readonly id: string }[], readonly formats: readonly { readonly id: string }[], readonly maxRows: number, readonly queue: object, readonly retention: object, readonly storage: object } }

export function transferDefinitionRevision<TRecord, TValues extends Readonly<Record<string, unknown>>, TActor extends object, TTenant>(definition: ImporterDefinition<TRecord, TValues, TActor, TTenant>): string
export function transferDefinitionRevision<TQuery, TRecord, TRecordId extends TableRecordIdentifier, TActor extends object, TTenant>(definition: ExporterDefinition<TQuery, TRecord, TRecordId, TActor, TTenant>): string
export function transferDefinitionRevision(definition: RevisionableDefinition): string {
  const metadata = definition.kind === 'import'
    ? {
        chunkSize: definition.server.chunkSize,
        columnKeys: definition.server.columns.map(column => column.key),
        definitionId: definition.id,
        formatIds: definition.server.formats.map(format => format.id),
        kind: definition.kind,
        limits: definition.server.limits,
        queue: definition.server.queue,
        resourceId: definition.resourceId,
        retention: definition.server.retention,
        storage: definition.server.storage,
      }
    : {
        chunkSize: definition.server.chunkSize,
        columnIds: definition.server.columns.map(column => column.id),
        definitionId: definition.id,
        formatIds: definition.server.formats.map(format => format.id),
        kind: definition.kind,
        maxRows: definition.server.maxRows,
        queue: definition.server.queue,
        resourceId: definition.resourceId,
        retention: definition.server.retention,
        storage: definition.server.storage,
      }
  return createHash('sha256').update(stableJson(metadata)).digest('hex')
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`
}
