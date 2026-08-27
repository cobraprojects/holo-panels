import type { ActionGroupManifest, ClientActionFrame, ClientActionManifest, ClientActionStore, JsonObject } from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'

export interface VueActionCustomProps<TResult = unknown> {
  readonly frame: ClientActionFrame<TResult>
  readonly setInput: (input: JsonObject) => void
  readonly submit: () => Promise<void>
}

export interface VueActionRendererProps<TResult = unknown> {
  readonly input?: JsonObject
  readonly action: Readonly<ClientActionManifest>
  readonly actions?: readonly Readonly<ClientActionManifest>[]
  readonly groups?: readonly Readonly<ActionGroupManifest>[]
  readonly panelId?: string
  readonly recordIds?: readonly (number | string)[]
  readonly registry?: ComponentRegistry
  readonly store: ClientActionStore<TResult>
}

export interface VueActionSlotProps<TResult = unknown> extends Record<string, unknown> {
  readonly frame: ClientActionFrame<TResult>
}
