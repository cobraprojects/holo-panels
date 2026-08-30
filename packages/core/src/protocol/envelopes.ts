import type { Effect } from './effects'
import type { JsonObject, JsonValue } from './json'
import type { PublicSourceLocation } from './source-location'
import type { LocaleDirection } from '../translations/contracts'

export interface ResponseLocale {
  direction: LocaleDirection
  locale: string
}

export type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'conflict'
  | 'internal'
  | 'not-found'
  | 'protocol'
  | 'rate-limit'
  | 'validation'

export interface PanelsError {
  category: ErrorCategory
  code: string
  details?: JsonObject
  location?: PublicSourceLocation
  message: string
  retryable: boolean
}

export interface RequestEnvelope<TPayload extends JsonValue = JsonObject> {
  id: string
  operation: string
  panelId: string
  payload: TPayload
  protocolVersion: string
}

interface SuccessEnvelopeBody<TData extends JsonValue = JsonValue> {
  data: TData
  effects: Effect[]
  id: string
  ok: true
  protocolVersion: string
}

interface ErrorEnvelopeBody {
  effects: Effect[]
  error: PanelsError
  id: string
  ok: false
  protocolVersion: string
}

type OptionalResponseLocale = ResponseLocale | { direction?: never, locale?: never }

export type SuccessEnvelope<TData extends JsonValue = JsonValue> = SuccessEnvelopeBody<TData> & OptionalResponseLocale

export type ErrorEnvelope = ErrorEnvelopeBody & OptionalResponseLocale

export type ResponseEnvelope<TData extends JsonValue = JsonValue> =
  | ErrorEnvelope
  | SuccessEnvelope<TData>
