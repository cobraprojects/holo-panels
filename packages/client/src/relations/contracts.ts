import type { JsonValue, RelationOperation, RelationPresentation } from '@holo-js/panels-core'

export interface ClientRelationColumn {
  readonly key: string
  readonly label: string
}

export interface ClientRelationRecord {
  readonly id: number | string
  readonly values: Readonly<Record<string, JsonValue>>
}

export interface ClientRelationManager {
  readonly badge: number | string | null
  readonly columns: readonly ClientRelationColumn[]
  readonly emptyMessage?: string
  readonly group: string | null
  readonly id: string
  readonly label: string
  readonly operations: readonly RelationOperation[]
  readonly presentation: RelationPresentation
  readonly records: readonly ClientRelationRecord[]
  readonly url: string | null
  readonly visible: boolean
}

export interface ClientRelationTabGroup {
  readonly activeId: string
  readonly id: string
  readonly label: string | null
  readonly managers: readonly ClientRelationManager[]
}

export interface ClientRelationLayout {
  readonly inline: readonly ClientRelationManager[]
  readonly pages: readonly ClientRelationManager[]
  readonly tabGroups: readonly ClientRelationTabGroup[]
}

export type ClientRelationSelection = Readonly<Record<string, string | undefined>>
