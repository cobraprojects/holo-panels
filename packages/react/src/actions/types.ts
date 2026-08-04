import type { ActionGroupManifest, ClientActionFrame, ClientActionManifest, ClientActionStore, JsonObject } from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'

export interface ReactActionCustomProps<TResult> {
  readonly frame: ClientActionFrame<TResult>
  readonly setInput: (input: JsonObject) => void
  readonly submit: () => Promise<void>
}

export interface ReactActionRendererProps<TResult = unknown> {
  readonly actions?: readonly Readonly<ClientActionManifest>[]
  readonly groups?: readonly Readonly<ActionGroupManifest>[]
  readonly manifest: Readonly<ClientActionManifest>
  readonly panelId?: string
  readonly recordIds?: readonly (number | string)[]
  readonly registry?: ComponentRegistry
  readonly store: ClientActionStore<TResult>
}

export interface ReactActionSlotProps<TResult = unknown> extends Record<string, unknown> {
  readonly frame: ClientActionFrame<TResult>
}
