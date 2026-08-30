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

export interface SuccessEnvelope<TData extends JsonValue = JsonValue> extends Partial<ResponseLocale> {
  data: TData
  effects: Effect[]
  id: string
  ok: true
  protocolVersion: string
}

export interface ErrorEnvelope extends Partial<ResponseLocale> {
  effects: Effect[]
  error: PanelsError
  id: string
  ok: false
  protocolVersion: string
}

export type ResponseEnvelope<TData extends JsonValue = JsonValue> =
  | ErrorEnvelope
  | SuccessEnvelope<TData>
