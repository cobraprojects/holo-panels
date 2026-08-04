import type { ClientRelationManager, ClientRelationSelection, RelationOperation } from '@holo-js/panels-client'

export interface VueRelationOperationRequest {
  readonly managerId: string
  readonly operation: RelationOperation
  readonly recordId?: number | string
}

export interface VueRelationManagerRendererProps {
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: VueRelationOperationRequest) => void | Promise<void>
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly selection?: ClientRelationSelection
}
