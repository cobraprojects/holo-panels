import type {
  ClientRelationManager,
  ClientRelationOption,
  ClientRelationSelection,
  JsonValue,
  RelationOperation,
} from '@holo-js/panels-client'

export interface ReactRelationOperationRequest {
  readonly managerId: string
  readonly operation: RelationOperation
  readonly pivot?: Readonly<Record<string, JsonValue>>
  readonly recordId?: number | string
  readonly values?: Readonly<Record<string, JsonValue>>
}

export interface ReactRelationManagerRendererProps {
  readonly loadOptions?: (managerId: string, search: string) => Promise<readonly ClientRelationOption[]>
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: ReactRelationOperationRequest) => void | Promise<void>
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly selection?: ClientRelationSelection
}
