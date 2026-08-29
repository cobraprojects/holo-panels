import type { ComponentRegistry } from '../registry'
import type { ClientRelationActionRequest, ClientRelationManager, ClientRelationOption, ClientRelationSelection, ClientRelationTablePage, ClientRelationTableRequest } from '@holo-js/panels-client'

export type VueRelationOperationRequest = ClientRelationActionRequest

export interface VueRelationManagerRendererProps {
  readonly loadOptions?: (managerId: string, search: string) => Promise<readonly ClientRelationOption[]>
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: VueRelationOperationRequest, signal?: AbortSignal) => void | Promise<void>
  readonly onTableQuery?: (request: ClientRelationTableRequest, signal?: AbortSignal) => Promise<ClientRelationTablePage>
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly registry?: ComponentRegistry
  readonly panelId?: string
  readonly selection?: ClientRelationSelection
}
