import { createPanelTranslator, panelNotification, type Effect } from '@holo-js/panels-core'
import type { ClientToastStore } from './toast-store'

const PANEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u
const stores = new Map<string, Map<symbol, { readonly store: ClientToastStore, readonly locale: string }>>()
let notificationSequence = 0

export function registerPanelNotificationStore(panelId: string, store: ClientToastStore, locale = 'en'): () => void {
  if (!PANEL_ID_PATTERN.test(panelId)) throw new Error('Panel notification stores require a canonical panel ID.')
  const registration = Symbol(panelId)
  const registrations = stores.get(panelId) ?? new Map<symbol, { readonly store: ClientToastStore, readonly locale: string }>()
  registrations.set(registration, { store, locale })
  stores.set(panelId, registrations)
  return () => {
    const current = stores.get(panelId)
    current?.delete(registration)
    if (current?.size === 0) stores.delete(panelId)
  }
}

export function publishPanelError(
  panelId: string,
  title: string,
  body?: string,
): boolean {
  const registrations = stores.get(panelId)
  const registration = registrations ? [...registrations.values()].at(-1) : undefined
  if (!registration) return false
  const { store, locale } = registration
  publishPanelErrorTo(store, title, body ?? createPanelTranslator(locale)('feedback.failed'))
  return true
}

export function publishPanelActionFailure(panelId: string, effects: readonly Effect[] = []): boolean {
  const registrations = stores.get(panelId)
  const registration = registrations ? [...registrations.values()].at(-1) : undefined
  if (!registration) return false
  const { store, locale } = registration
  const deliveredIds = new Set(store.state.items.map(item => item.id))
  const richNotificationDelivered = effects.some(effect => (
    effect.kind === 'toast'
    && 'presentation' in effect
    && deliveredIds.has(effect.presentation.id)
  ))
  if (richNotificationDelivered) return false
  publishPanelErrorTo(store, createPanelTranslator(locale)('feedback.actionFailed'), createPanelTranslator(locale)('feedback.failed'))
  return true
}

export function publishPanelErrorTo(
  store: ClientToastStore,
  title: string,
  body = 'The operation could not be completed.',
): void {
  notificationSequence += 1
  store.push(panelNotification(`client.feedback.${notificationSequence}`)
    .title(title)
    .body(body)
    .status('danger')
    .presentation())
}
