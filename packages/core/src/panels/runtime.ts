import { DB } from '@holo-js/db'
import type { JsonObject } from '../protocol/json'
import type { ToastEffect } from '../protocol/effects'
import { toJsonValue } from '../protocol/serialization'
import { withPanelNotificationContext } from '../notifications/dispatch-context'
import type {
  CompiledPanelDefinition,
  HoloAuth,
  PanelAuthenticatedScope,
  PanelBootstrap,
  PanelManifest,
  PanelNotificationBootstrap,
  PanelMiddleware,
  PanelOperation,
} from './contracts'
import { canonicalLocale } from '../translations/catalog-registry'

export class PanelRuntimeError extends Error {
  constructor(readonly code: 'access-denied' | 'actor-not-serializable' | 'panel-not-found' | 'subscription-required' | 'unauthenticated', message: string) {
    super(message)
    this.name = 'PanelRuntimeError'
  }
}

export class PanelSubscriptionRequiredError extends PanelRuntimeError {
  constructor(readonly billingPath: string) {
    super('subscription-required', 'An active tenant subscription is required')
    this.name = 'PanelSubscriptionRequiredError'
  }
}

interface ResolvedGuard<TActor> {
  readonly actor: TActor
  readonly provider: string | null
}

const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u
const TRANSACTIONAL_OPERATIONS: ReadonlySet<PanelOperation> = new Set(['action', 'form-submit', 'notification', 'upload'])
const BOOTED_PANELS = new WeakMap<object, Promise<void>>()

export function panelErrorNotificationEffect<TActor>(
  panel: CompiledPanelDefinition<TActor>,
  statusCode: number,
): Readonly<ToastEffect> | null {
  if (statusCode === 422) return null
  const configuration = panel.manifest.errorNotifications
  if (!configuration?.enabled) return null
  if (configuration.disabledStatusCodes.includes(statusCode) || configuration.hiddenStatusCodes.includes(statusCode)) return null
  const notification = configuration.notifications.find(candidate => candidate.statusCode === statusCode)
    ?? configuration.notifications.find(candidate => candidate.statusCode === null)
  return Object.freeze({
    kind: 'toast',
    level: 'danger',
    message: notification?.body ?? 'Please try again later.',
    title: notification?.title ?? 'An error occurred',
  })
}

export async function bootPanel<TActor>(panel: CompiledPanelDefinition<TActor>): Promise<void> {
  const existing = BOOTED_PANELS.get(panel)
  if (existing) return existing
  const pending = Promise.all((panel.server.boot ?? []).map(async callback => {
    await callback(Object.freeze({ guard: panel.guard, manifest: panel.manifest }))
  })).then(() => undefined)
  BOOTED_PANELS.set(panel, pending)
  try {
    await pending
  } catch (error) {
    BOOTED_PANELS.delete(panel)
    throw error
  }
}

export async function executePanelPipeline<TActor, TResult>(
  panel: CompiledPanelDefinition<TActor>,
  scope: PanelAuthenticatedScope<TActor>,
  operation: PanelOperation,
  handler: () => TResult | Promise<TResult>,
  options: { readonly initial?: boolean } = {},
): Promise<TResult> {
  await bootPanel(panel)
  const terminal = (): Promise<TResult> => withPanelNotificationContext(async () => {
    const tenancy = await panel.server.tenancy?.activeContext(scope)
    const inbox = tenancy ? null : await panel.server.notifications?.inbox?.resolve(scope)
    return { guard: panel.guard, panelId: panel.manifest.id, tenantId: tenancy?.tenantId ?? inbox?.tenantId ?? null }
  }, async () => {
    if (panel.manifest.runtime?.databaseTransactions && TRANSACTIONAL_OPERATIONS.has(operation)) {
      return DB.writeTransaction(async () => await handler())
    }
    return handler()
  }, { panel: panel as CompiledPanelDefinition<object>, scope: scope as PanelAuthenticatedScope<object> })
  const configured = panel.server.middleware
  if (!configured) return terminal()
  const middleware = options.initial ?? operation === 'bootstrap'
    ? [...configured.panel, ...configured.authenticated, ...(panel.server.tenancy ? configured.tenant : [])]
    : [
        ...(configured.persistent?.panel ?? []),
        ...(configured.persistent?.authenticated ?? []),
        ...(panel.server.tenancy ? configured.persistent?.tenant ?? [] : []),
      ]
  const context = Object.freeze({ ...scope, operation })
  const invoke = middleware.reduceRight<() => Promise<unknown>>(
    (next, current: PanelMiddleware<TActor>) => async () => await current(context, next),
    async () => await terminal(),
  )
  return await invoke() as TResult
}

export class PanelRuntime<TActor> {
  readonly #panels: ReadonlyMap<string, CompiledPanelDefinition<TActor>>

  constructor(readonly auth: HoloAuth<TActor>, panels: readonly CompiledPanelDefinition<TActor>[]) {
    const entries = panels.map(panel => [panel.manifest.id, panel] as const)
    if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new Error('Panel IDs must be unique')
    if (panels.filter(panel => panel.manifest.default).length > 1) throw new Error('Only one panel can be the default')
    this.#panels = new Map(entries)
  }

  async bootstrap(panelIds: readonly string[], signal: AbortSignal, requestedLocale?: string): Promise<readonly Readonly<PanelBootstrap>[]> {
    if (new Set(panelIds).size !== panelIds.length) throw new Error('Panel bootstrap IDs must be unique')
    const guards = new Map<string, Promise<ResolvedGuard<TActor>>>()
    return Promise.all(panelIds.map(async panelId => {
      const panel = this.panel(panelId)
      await bootPanel(panel)
      let resolved = guards.get(panel.guard)
      if (!resolved) {
        resolved = this.resolveGuard(panel.guard)
        guards.set(panel.guard, resolved)
      }
      const guard = await resolved
      const scope = await this.authorize(panel, 'bootstrap', signal, guard)
      return executePanelPipeline(panel, scope, 'bootstrap', () => this.bootstrapPayload(panel, scope, requestedLocale))
    }))
  }

  async execute<TResult>(
    panelId: string,
    operation: PanelOperation,
    signal: AbortSignal,
    handler: (scope: PanelAuthenticatedScope<TActor>) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    const panel = this.panel(panelId)
    await bootPanel(panel)
    const guard = await this.resolveGuard(panel.guard)
    const scope = await this.authorize(panel, operation, signal, guard)
    const billing = panel.server.tenancy?.billing
    if (operation !== 'bootstrap' && panel.manifest.tenancy?.requiresSubscription && billing) {
      const subscribed = billing.getSubscribedMiddleware()
      if (typeof subscribed !== 'function') throw new TypeError('Panel tenant billing providers must return a subscription middleware function')
      if (!await subscribed(scope)) throw new PanelSubscriptionRequiredError(panel.manifest.tenancy.billing?.path ?? panel.manifest.path)
    }
    return executePanelPipeline(panel, scope, operation, () => handler(scope))
  }

  private panel(panelId: string): CompiledPanelDefinition<TActor> {
    const panel = this.#panels.get(panelId)
    if (!panel) throw new PanelRuntimeError('panel-not-found', `Panel "${panelId}" is not registered`)
    return panel
  }

  private async resolveGuard(guard: string): Promise<ResolvedGuard<TActor>> {
    const facade = this.auth.guard(guard)
    const [actor, provider] = await Promise.all([facade.user(), facade.provider()])
    if (actor === null) throw new PanelRuntimeError('unauthenticated', `Authentication is required for guard "${guard}"`)
    return { actor, provider }
  }

  private async authorize(
    panel: CompiledPanelDefinition<TActor>,
    operation: PanelOperation,
    signal: AbortSignal,
    guard: ResolvedGuard<TActor>,
  ): Promise<PanelAuthenticatedScope<TActor>> {
    const context = Object.freeze({ actor: guard.actor, guard: panel.guard, operation, panelId: panel.manifest.id, provider: guard.provider, signal })
    if (!await panel.server.access(context)) throw new PanelRuntimeError('access-denied', `Access to panel "${panel.manifest.id}" was denied`)
    return context
  }

  private async bootstrapPayload(panel: CompiledPanelDefinition<TActor>, scope: PanelAuthenticatedScope<TActor>, requestedLocale?: string): Promise<Readonly<PanelBootstrap>> {
    const actor = toJsonValue(await panel.server.presentActor(scope.actor))
    if (actor === null || Array.isArray(actor) || typeof actor !== 'object') {
      throw new PanelRuntimeError('actor-not-serializable', 'Panel actors must serialize to JSON objects')
    }
    const notifications = await this.notificationBootstrap(panel, scope)
    const tenancy = panel.server.tenancy ? await panel.server.tenancy.bootstrap(scope) : null
    const locale = this.resolveLocale(panel.manifest.locales, requestedLocale, scope.actor)
    return Object.freeze({ actor: actor as JsonObject, direction: locale === 'ar' ? 'rtl' : 'ltr', locale, manifest: panel.manifest, notifications, provider: scope.provider, tenancy })
  }

  private resolveLocale(
    configuration: PanelManifest['locales'],
    requestedLocale: string | undefined,
    actor: TActor,
  ): string {
    const allowed = new Set(configuration.allowed.map(canonicalLocale))
    const actorLocale = typeof actor === 'object' && actor !== null && 'locale' in actor && typeof actor.locale === 'string'
      ? actor.locale
      : undefined
    for (const candidate of [requestedLocale, actorLocale, configuration.fallback]) {
      if (!candidate?.trim()) continue
      let canonical: string
      try {
        canonical = canonicalLocale(candidate)
      } catch {
        continue
      }
      const hierarchy = canonical.split('-').map((_segment, index, segments) => segments.slice(0, segments.length - index).join('-'))
      const matched = hierarchy.find(locale => allowed.has(locale))
      if (matched) return matched
    }
    return configuration.fallback
  }

  private async notificationBootstrap(
    panel: CompiledPanelDefinition<TActor>,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<Readonly<PanelNotificationBootstrap> | null> {
    const configuration = panel.manifest.databaseNotifications
    if (configuration === null) return null
    if (!configuration.realtime || panel.manifest.runtime?.broadcasting === false) return Object.freeze({ realtimeChannel: null })
    const inbox = panel.server.notifications?.inbox
    if (!inbox) return Object.freeze({ realtimeChannel: null })
    if (!await inbox.authorize('list', scope)) return Object.freeze({ realtimeChannel: null })
    const { realtimeChannel } = await inbox.resolve(scope)
    if (realtimeChannel === null) return Object.freeze({ realtimeChannel: null })
    if (
      typeof realtimeChannel !== 'string'
      || realtimeChannel !== realtimeChannel.trim()
      || !REALTIME_CHANNEL.test(realtimeChannel)
      || realtimeChannel.startsWith('private-')
      || realtimeChannel.startsWith('presence-')
    ) {
      throw new Error('Panel notification realtime channels require a bounded stable channel name')
    }
    return Object.freeze({ realtimeChannel })
  }
}
