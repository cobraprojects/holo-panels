import type {
  ClientRelationManager,
  ClientRelationSelection,
  RelationOperation,
} from '@holo-js/panels-client'

export interface ReactRelationOperationRequest {
  readonly managerId: string
  readonly operation: RelationOperation
  readonly recordId?: number | string
}

export interface ReactRelationManagerRendererProps {
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: ReactRelationOperationRequest) => void | Promise<void>
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly selection?: ClientRelationSelection
}
