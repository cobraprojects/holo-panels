import type { ClientRelationManager, ClientRelationSelection, RelationOperation } from '@holo-js/panels-client'

export interface SvelteRelationOperationRequest {
  readonly managerId: string
  readonly operation: RelationOperation
  readonly recordId?: number | string
}

export interface SvelteRelationManagerRendererProps {
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: SvelteRelationOperationRequest) => void | Promise<void>
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly selection?: ClientRelationSelection
}
