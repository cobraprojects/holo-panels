import type { ActionManifest, ActionMount, JsonObject, JsonValue, RelationOperation, RelationPresentation } from '@holo-js/panels-core'

export interface ClientRelationColumn {
  readonly key: string
  readonly label: string
}

export interface ClientRelationRecord {
  readonly id: number | string
  readonly values: Readonly<Record<string, JsonValue>>
}

export interface ClientRelationField {
  readonly id: string
  readonly label: string
  readonly required: boolean
  readonly type: 'date-time' | 'number' | 'text' | 'textarea' | 'toggle'
}

export interface ClientRelationOption {
  readonly label: string
  readonly value: number | string
}

export interface ClientRelationManager {
  readonly actions?: readonly ActionManifest[]
  readonly recordActions?: readonly { readonly recordId: number | string, readonly actions: readonly ActionManifest[] }[]
  readonly badge: number | string | null
  readonly columns: readonly ClientRelationColumn[]
  readonly emptyMessage?: string
  readonly fields?: readonly ClientRelationField[]
  readonly group: string | null
  readonly id: string
  readonly label: string
  readonly operations: readonly RelationOperation[]
  readonly presentation: RelationPresentation
  readonly pivotFields?: readonly ClientRelationField[]
  readonly records: readonly ClientRelationRecord[]
  readonly url: string | null
  readonly visible: boolean
}

export interface ClientRelationActionRequest {
  readonly actionId?: string
  readonly idempotencyKey?: string
  readonly input?: JsonObject
  readonly managerId: string
  readonly mount?: ActionMount
  readonly operation: RelationOperation | 'custom'
  readonly pivot?: Readonly<JsonObject>
  readonly recordId?: number | string
  readonly recordIds?: readonly (number | string)[]
  readonly values?: Readonly<JsonObject>
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
