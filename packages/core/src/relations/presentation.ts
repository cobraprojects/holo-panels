import type { JsonValue } from '../protocol/json'

export type RelationOperation =
  | 'associate'
  | 'attach'
  | 'create'
  | 'delete'
  | 'detach'
  | 'dissociate'
  | 'edit'
  | 'editPivot'
  | 'list'
  | 'select'
  | 'view'

export type RelationPresentation = 'groupedTabs' | 'inline' | 'page' | 'tabs'

export interface RelationListRequest {
  readonly filters?: Readonly<Record<string, JsonValue>>
  readonly includeTotal?: boolean
  readonly page?: number
  readonly perPage?: number
  readonly search?: string
  readonly sort?: readonly RelationListSort[]
}

export interface NormalizedRelationListRequest {
  readonly filters: Readonly<Record<string, JsonValue>>
  readonly includeTotal: boolean
  readonly page: number
  readonly perPage: number
  readonly search: string
  readonly sort: readonly RelationListSort[]
}

export interface RelationListSort {
  readonly column: string
  readonly direction: 'asc' | 'desc'
}

export interface RelationRecordPage<TRelated> {
  readonly hasMore: boolean
  readonly page: number
  readonly perPage: number
  readonly records: readonly TRelated[]
  readonly total?: number
}
