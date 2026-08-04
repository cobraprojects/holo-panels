import type { ActionGroupManifest, ClientActionFrame, ClientActionManifest, ClientActionStore, JsonObject } from '@holo-js/panels-client'
import type { SvelteComponentRegistry } from '../registry'

export interface SvelteActionCustomProps<TResult = unknown> extends Record<string, unknown> {
  readonly frame: ClientActionFrame<TResult>
  readonly setInput: (input: JsonObject) => void
  readonly submit: () => Promise<void>
}

export interface SvelteActionRendererProps<TResult = unknown> {
  readonly action: Readonly<ClientActionManifest>
  readonly actions?: readonly Readonly<ClientActionManifest>[]
  readonly groups?: readonly Readonly<ActionGroupManifest>[]
  readonly panelId?: string
  readonly recordIds?: readonly (number | string)[]
  readonly registry?: SvelteComponentRegistry
  readonly store: ClientActionStore<TResult>
}

export interface SvelteActionSlotProps<TResult = unknown> extends Record<string, unknown> {
  readonly frame: ClientActionFrame<TResult>
}
