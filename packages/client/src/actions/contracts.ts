import type {
  ActionExecutionResult,
  ActionManifest,
  ActionMount,
  JsonObject,
} from '@holo-js/panels-core'

export type ClientActionManifest = ActionManifest

export type ClientActionPhase = 'collecting' | 'confirming' | 'failed' | 'ready' | 'submitting' | 'succeeded'

export interface ClientActionFrame<TResult = unknown> {
  readonly error: string | null
  readonly input: JsonObject
  readonly manifest: Readonly<ClientActionManifest>
  readonly parentId: string | null
  readonly phase: ClientActionPhase
  readonly requestVersion: number
  readonly result?: ActionExecutionResult<number | string, TResult>
}

export interface ClientActionState<TResult = unknown> {
  readonly frames: readonly ClientActionFrame<TResult>[]
  readonly version: number
}

export interface ClientActionRequest {
  readonly actionId: string
  readonly idempotencyKey: string
  readonly input: JsonObject
  readonly mount: ActionMount
  readonly recordIds?: readonly (number | string)[]
}

export interface ClientActionTransport<TResult> {
  execute(request: ClientActionRequest, signal: AbortSignal): Promise<ActionExecutionResult<number | string, TResult>>
}

export interface ClientActionStoreOptions<TResult> {
  readonly createIdempotencyKey: () => string
  readonly transport: ClientActionTransport<TResult>
}

export type ClientActionStateListener<TResult> = (
  state: ClientActionState<TResult>,
  previous: ClientActionState<TResult>,
) => void
