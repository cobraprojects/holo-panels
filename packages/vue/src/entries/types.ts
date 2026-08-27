import type { ClientActionManifest, ClientActionStore, EntrySnapshot, EntryStateStore, ScopedRenderSlotManifest } from '@holo-js/panels-client'
import type { VNodeChild } from 'vue'
import type { ComponentRegistry } from '../registry'

export type VueEntrySnapshot = EntrySnapshot
export type VueEntryStore = Pick<EntryStateStore, 'snapshot' | 'subscribe'>

export interface VueEntryRendererProps {
  readonly action?: (id: string) => Promise<void> | void
  readonly actions?: readonly Readonly<ClientActionManifest>[]
  readonly actionStore?: ClientActionStore
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly recordIds?: readonly (number | string)[]
  readonly store: VueEntryStore
}

export interface VueCustomEntryProps extends VueEntryRendererProps {
  readonly entry: VueEntrySnapshot
}

export interface VueEntrySlotRendererProps {
  readonly entry: VueEntrySnapshot
  readonly placement: 'above' | 'after' | 'before' | 'below'
  readonly reference: ScopedRenderSlotManifest
}

export type VueEntryContent = VNodeChild
