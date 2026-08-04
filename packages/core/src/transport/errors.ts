import type { ErrorCategory, PanelsError } from '../protocol/envelopes'

const STATUS_CATEGORIES: Readonly<Record<number, ErrorCategory>> = Object.freeze({
  400: 'validation',
  401: 'authentication',
  403: 'authorization',
  404: 'not-found',
  409: 'conflict',
  419: 'authorization',
  422: 'validation',
  429: 'rate-limit',
})

const CATEGORY_MESSAGES: Readonly<Record<ErrorCategory, string>> = Object.freeze({
  authentication: 'Authentication is required.',
  authorization: 'You are not authorized to perform this operation.',
  conflict: 'The operation conflicts with the current state.',
  internal: 'The operation could not be completed.',
  'not-found': 'The requested resource was not found.',
  protocol: 'The response protocol is incompatible.',
  'rate-limit': 'Too many requests. Try again later.',
  validation: 'The submitted data is invalid.',
})

function statusFromError(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as Record<string, unknown>
  for (const key of ['status', 'statusCode'] as const) {
    const value = record[key]
    if (typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599) return value
  }
  const digest = typeof record.digest === 'string' ? record.digest : undefined
  const matched = digest?.match(/^NEXT_HTTP_ERROR_FALLBACK;(\d{3})$/)?.[1]
  return matched ? Number(matched) : undefined
}

export function normalizeTransportError(error: unknown, explicitStatus?: number): Readonly<PanelsError> {
  const status = explicitStatus ?? statusFromError(error)
  const category = (status ? STATUS_CATEGORIES[status] : undefined) ?? 'internal'
  const retryable = typeof status === 'number'
    ? status === 408 || status === 425 || status === 429 || status >= 500
    : true
  return Object.freeze({
    category,
    code: status ? `http_${status}` : 'transport_failure',
    message: CATEGORY_MESSAGES[category],
    retryable,
  })
}

export class PanelsTransportError extends Error {
  readonly panelsError: Readonly<PanelsError>

  constructor(error: Readonly<PanelsError>) {
    super(error.message)
    this.name = 'PanelsTransportError'
    this.panelsError = error
  }
}
