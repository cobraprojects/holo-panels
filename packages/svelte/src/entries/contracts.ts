import type { EntrySnapshot, EntryStateStore, ScopedRenderSlotManifest } from '@holo-js/panels-client'
import type { SvelteComponentRegistry } from '../registry'

export type SvelteEntrySnapshot = EntrySnapshot
export type SvelteEntryStore = Pick<EntryStateStore, 'snapshot' | 'subscribe'>

export interface SvelteEntryRendererProps extends Record<string, unknown> {
  readonly action?: (id: string) => Promise<void> | void
  readonly panelId?: string
  readonly registry?: SvelteComponentRegistry
  readonly store: SvelteEntryStore
}

export interface SvelteCustomEntryProps extends SvelteEntryRendererProps {
  readonly entry: SvelteEntrySnapshot
}

export interface SvelteEntrySlotRendererProps extends Record<string, unknown> {
  readonly entry: SvelteEntrySnapshot
  readonly placement: 'above' | 'after' | 'before' | 'below'
  readonly reference: ScopedRenderSlotManifest
}
