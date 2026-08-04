import type { RequestEnvelope, ResponseEnvelope } from '../protocol/envelopes'
import type { JsonObject, JsonValue } from '../protocol/json'
import type { RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'

export const TRANSPORT_REQUEST_FIELD = 'request' as const
export const IDEMPOTENCY_HEADER = 'Idempotency-Key' as const

export type TransportOperationKind = 'read' | 'mutation'

declare const transportData: unique symbol
declare const transportPayload: unique symbol

export interface TransportOperation<
  TPayload extends JsonValue = JsonObject,
  TData extends JsonValue = JsonValue,
> {
  readonly kind: TransportOperationKind
  readonly name: string
  readonly supportsIdempotency?: boolean
  readonly [transportData]?: TData
  readonly [transportPayload]?: TPayload
}

export interface TransportRequestOptions<TPayload extends JsonValue = JsonObject> {
  readonly id: string
  readonly operation: string
  readonly panelId: string
  readonly payload: TPayload
}

export interface TransportDecodedRequest<TPayload extends JsonValue = JsonObject> {
  readonly envelope: Readonly<RequestEnvelope<TPayload>>
  readonly idempotencyKey?: string
}

export interface TransportServerRequestLike {
  formData(): Promise<{ get(name: string): unknown }>
  readonly headers: { get(name: string): string | null }
}

export interface TransportServerResult<TData extends JsonValue = JsonValue> {
  readonly response: Readonly<ResponseEnvelope<TData>>
  readonly status: number
}

export function defineTransportOperation<
  TPayloadSource extends RuntimeTypeSource,
  TDataSource extends RuntimeTypeSource,
>(
  _sources: { readonly data: TDataSource, readonly payload: TPayloadSource },
  operation: Omit<TransportOperation<RuntimeTypeValue<TPayloadSource> & JsonValue, RuntimeTypeValue<TDataSource> & JsonValue>, typeof transportData | typeof transportPayload>,
): Readonly<TransportOperation<RuntimeTypeValue<TPayloadSource> & JsonValue, RuntimeTypeValue<TDataSource> & JsonValue>> {
  if (!operation.name.trim()) throw new Error('[Holo Panels] Transport operation name cannot be empty.')
  if (operation.kind === 'read' && operation.supportsIdempotency) {
    throw new Error('[Holo Panels] Read operations cannot declare mutation idempotency.')
  }
  return Object.freeze({ ...operation })
}
