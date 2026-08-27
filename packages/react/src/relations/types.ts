import type { ComponentRegistry } from '../registry'
import type {
  ClientRelationManager,
  ClientRelationOption,
  ClientRelationSelection,
  ClientRelationActionRequest,
} from '@holo-js/panels-client'

export type ReactRelationOperationRequest = ClientRelationActionRequest

export interface ReactRelationManagerRendererProps {
  readonly loadOptions?: (managerId: string, search: string) => Promise<readonly ClientRelationOption[]>
  readonly managers: readonly ClientRelationManager[]
  readonly onOperation?: (request: ReactRelationOperationRequest, signal?: AbortSignal) => void | Promise<void>
  readonly registry?: ComponentRegistry
  readonly panelId?: string
  readonly onSelectionChange?: (groupId: string, managerId: string) => void
  readonly selection?: ClientRelationSelection
}
