import type { ComponentRegistry } from '../registry'
import type { ClientRelationActionRequest, ClientRelationManager, ClientRelationOption, ClientRelationSelection } from '@holo-js/panels-client'

export type VueRelationOperationRequest = ClientRelationActionRequest

export interface VueRelationManagerRendererProps {
  readonly loadOptions?: (managerId: string, search: string) => Promise<readonly ClientRelationOption[]>
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: VueRelationOperationRequest, signal?: AbortSignal) => void | Promise<void>
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly registry?: ComponentRegistry
  readonly panelId?: string
  readonly selection?: ClientRelationSelection
}
