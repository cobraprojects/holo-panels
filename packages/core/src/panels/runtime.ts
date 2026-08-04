import type { JsonObject } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type {
  CompiledPanelDefinition,
  HoloAuth,
  PanelAuthenticatedScope,
  PanelBootstrap,
  PanelNotificationBootstrap,
  PanelOperation,
} from './contracts'

export class PanelRuntimeError extends Error {
  constructor(readonly code: 'access-denied' | 'actor-not-serializable' | 'panel-not-found' | 'unauthenticated', message: string) {
    super(message)
    this.name = 'PanelRuntimeError'
  }
}

interface ResolvedGuard<TActor> {
  readonly actor: TActor
  readonly provider: string | null
}

const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u

export class PanelRuntime<TActor> {
  readonly #panels: ReadonlyMap<string, CompiledPanelDefinition<TActor>>

  constructor(readonly auth: HoloAuth<TActor>, panels: readonly CompiledPanelDefinition<TActor>[]) {
    const entries = panels.map(panel => [panel.manifest.id, panel] as const)
    if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new Error('Panel IDs must be unique')
    if (panels.filter(panel => panel.manifest.default).length > 1) throw new Error('Only one panel can be the default')
    this.#panels = new Map(entries)
  }

  async bootstrap(panelIds: readonly string[], signal: AbortSignal): Promise<readonly Readonly<PanelBootstrap>[]> {
    if (new Set(panelIds).size !== panelIds.length) throw new Error('Panel bootstrap IDs must be unique')
    const guards = new Map<string, Promise<ResolvedGuard<TActor>>>()
    return Promise.all(panelIds.map(async panelId => {
      const panel = this.panel(panelId)
      let resolved = guards.get(panel.guard)
      if (!resolved) {
        resolved = this.resolveGuard(panel.guard)
        guards.set(panel.guard, resolved)
      }
      const guard = await resolved
      const scope = await this.authorize(panel, 'bootstrap', signal, guard)
      return this.bootstrapPayload(panel, scope)
    }))
  }

  async execute<TResult>(
    panelId: string,
    operation: PanelOperation,
    signal: AbortSignal,
    handler: (scope: PanelAuthenticatedScope<TActor>) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    const panel = this.panel(panelId)
    const guard = await this.resolveGuard(panel.guard)
    const scope = await this.authorize(panel, operation, signal, guard)
    return handler(scope)
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

  private async bootstrapPayload(panel: CompiledPanelDefinition<TActor>, scope: PanelAuthenticatedScope<TActor>): Promise<Readonly<PanelBootstrap>> {
    const actor = toJsonValue(await panel.server.presentActor(scope.actor))
    if (actor === null || Array.isArray(actor) || typeof actor !== 'object') {
      throw new PanelRuntimeError('actor-not-serializable', 'Panel actors must serialize to JSON objects')
    }
    const notifications = await this.notificationBootstrap(panel, scope)
    const tenancy = panel.server.tenancy ? await panel.server.tenancy.bootstrap(scope) : null
    return Object.freeze({ actor: actor as JsonObject, manifest: panel.manifest, notifications, provider: scope.provider, tenancy })
  }

  private async notificationBootstrap(
    panel: CompiledPanelDefinition<TActor>,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<Readonly<PanelNotificationBootstrap> | null> {
    const configuration = panel.manifest.databaseNotifications
    if (configuration === null) return null
    if (!configuration.realtime) return Object.freeze({ realtimeChannel: null })
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
