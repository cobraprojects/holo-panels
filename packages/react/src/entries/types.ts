import type { ClientActionManifest, ClientActionStore, EntrySnapshot, EntryStateStore, ScopedRenderSlotManifest } from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'

export type ReactEntrySnapshot = EntrySnapshot
export type ReactEntryStore = Pick<EntryStateStore, 'snapshot' | 'subscribe'>

export interface ReactEntryRendererProps {
  readonly action?: (id: string) => Promise<void> | void
  readonly actions?: readonly Readonly<ClientActionManifest>[]
  readonly actionStore?: ClientActionStore
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly recordIds?: readonly (number | string)[]
  readonly store: ReactEntryStore
}

export interface ReactCustomEntryProps extends ReactEntryRendererProps {
  readonly entry: ReactEntrySnapshot
}

export interface ReactEntrySlotRendererProps {
  readonly entry: ReactEntrySnapshot
  readonly placement: 'above' | 'after' | 'before' | 'below'
  readonly reference: ScopedRenderSlotManifest
}
