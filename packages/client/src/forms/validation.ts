import { PanelsTransportError } from '@holo-js/panels-core'
import type { FormErrorBag } from './types'
import { parseFormPath } from './paths'

export function formValidationErrors(cause: unknown): FormErrorBag | null {
  if (!(cause instanceof PanelsTransportError) || cause.panelsError.category !== 'validation') return null
  const fields = cause.panelsError.details?.errors
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return { _root: [cause.panelsError.message] }
  const errors = Object.fromEntries(Object.entries(fields).flatMap(([path, messages]) => {
    try { parseFormPath(path) } catch { return [] }
    return Array.isArray(messages) && messages.length > 0 && messages.every((message): message is string => typeof message === 'string' && message.trim().length > 0) ? [[path, messages]] : []
  }))
  return Object.keys(errors).length ? errors : { _root: [cause.panelsError.message] }
}

export function formValidationFailure(errors: FormErrorBag): PanelsTransportError {
  return new PanelsTransportError({
    category: 'validation',
    code: 'invalid_form',
    details: { errors: Object.fromEntries(Object.entries(errors).map(([path, messages]) => [path, [...messages]])) },
    message: 'The submitted data is invalid.',
    retryable: false,
  })
}
