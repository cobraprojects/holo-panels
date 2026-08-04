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
  readonly includeTotal?: boolean
  readonly page?: number
  readonly perPage?: number
}

export interface NormalizedRelationListRequest {
  readonly includeTotal: boolean
  readonly page: number
  readonly perPage: number
}

export interface RelationRecordPage<TRelated> {
  readonly hasMore: boolean
  readonly page: number
  readonly perPage: number
  readonly records: readonly TRelated[]
  readonly total?: number
}
