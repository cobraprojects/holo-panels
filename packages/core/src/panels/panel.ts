import { ConstructionBuilder } from '../builders/construction-builder'
import { compilePanelAuth } from '../auth/compile'
import type { CompiledPanelAuth, PanelAuthPageConfiguration } from '../auth/contracts'
import type { ComponentDefault } from '../defaults/component-default'
import { DISCOVERY_MARKER, type DiscoverableBuilder, type DiscoverableDefinition, type DiscoveryDirectories } from '../discovery/types'
import type { PluginCompatibility } from '../plugins/compatibility'
import type { PanelPlugin, PanelPluginInstallation } from '../plugins/panel-plugin'
import { toJsonValue } from '../protocol/serialization'
import type { RenderSlotReference } from '../schemas/contracts'
import type { RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import { compilePanelTenancy } from '../tenancy/compiled'
import type { CompiledPanelTenancy, PanelTenancyOptions, PanelTenantIdentifier } from '../tenancy/contracts'
import type {
  CompiledPanelDefinition,
  PanelAccessContext,
  PanelActorPresenter,
  PanelBranding,
  PanelDatabaseNotificationConfiguration,
  PanelDatabaseNotificationInboxOptions,
  PanelNavigationMode,
  PanelNavigationSeed,
  PanelTheme,
  PanelUserMenuItem,
} from './contracts'
import { appendScopedRenderSlot, type PanelRenderSlot, type ScopedRenderSlots } from './render-slots'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/u

interface PanelState<TActor> {
  access: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>
  actorPresenter: PanelActorPresenter<TActor>
  auth: ((path: string) => CompiledPanelAuth<TActor>) | null
  branding: PanelBranding
  databaseNotifications: PanelDatabaseNotificationConfiguration | null
  databaseNotificationInbox: PanelDatabaseNotificationInboxOptions<TActor> | null
  defaults: readonly ComponentDefault[]
  defaultPanel: boolean
  discover: DiscoveryDirectories
  guard: string
  navigation: PanelNavigationSeed[]
  navigationMode: PanelNavigationMode
  path: string
  plugins: readonly PanelPlugin<TActor>[]
  sidebarCollapsible: boolean
  slots: ScopedRenderSlots<PanelRenderSlot>
  theme: PanelTheme
  tenancy: CompiledPanelTenancy<TActor> | null
  userMenu: PanelUserMenuItem[]
}

interface PreparedPanelPluginInstallation<TActor> extends PanelPluginInstallation<TActor> {
  readonly compatibility: PluginCompatibility
  readonly packageName: string
}

interface PanelDiscoveryServer {
  readonly plugins: readonly {
    readonly compatibility: PluginCompatibility
    readonly contributions: PanelPluginInstallation<unknown>['contributions']
    readonly id: string
    readonly packageName: string
  }[]
}

const HTTPS_URL = /^https:\/\//iu

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
}

function destinationPath(value: string, base: string, label: string): string {
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\') || hasControlCharacter(candidate) || candidate.includes('?') || candidate.includes('#')) {
    throw new Error(`${label} must be a safe panel route`)
  }
  const path = candidate.startsWith('/') ? candidate : `${base === '/' ? '' : base}/${candidate}`
  if (path.includes('//') || path.split('/').some(segment => segment === '.' || segment === '..' || /%(?:2e|2f|5c)/iu.test(segment))) {
    throw new Error(`${label} must be a safe panel route`)
  }
  if (!/^\/(?:[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)*)?$/iu.test(path)) {
    throw new Error(`${label} must contain static route segments`)
  }
  if (base !== '/' && path !== base && !path.startsWith(`${base}/`)) throw new Error(`${label} must remain inside the fixed panel path`)
  return path
}

function brandingUrl(value: string | null, label: string): string | null {
  if (value === null) return null
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\') || hasControlCharacter(candidate) || candidate.startsWith('//')) throw new Error(`${label} must be a safe URL`)
  if (candidate.startsWith('/')) {
    if (candidate.includes('..') || /%(?:2e|2f|5c)/iu.test(candidate)) throw new Error(`${label} must be a safe URL`)
    return candidate
  }
  if (!HTTPS_URL.test(candidate)) throw new Error(`${label} must use an absolute path or HTTPS URL`)
  const url = new URL(candidate)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be a credential-free HTTPS URL`)
  return candidate
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} requires a stable identifier`)
}

function panelPath(value: string): string {
  const path = `/${value.trim().replace(/^\/+|\/+$/gu, '')}`
  if (!/^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/u.test(path)) throw new Error('Panel paths require static route segments')
  return path
}

function databaseNotificationConfiguration(
  options: Partial<PanelDatabaseNotificationConfiguration>,
): PanelDatabaseNotificationConfiguration {
  const placement = options.placement ?? 'topbar'
  const polling = options.polling ?? 30_000
  const realtime = options.realtime ?? false
  if (placement !== 'sidebar' && placement !== 'topbar') throw new Error('Database notification placement must be sidebar or topbar')
  if (polling !== false && (!Number.isInteger(polling) || polling < 1_000 || polling > 3_600_000)) {
    throw new Error('Database notification polling must be false or an integer between 1000 and 3600000 milliseconds')
  }
  if (typeof realtime !== 'boolean') throw new Error('Database notification realtime must be boolean')
  return { placement, polling, realtime }
}

export class PanelBuilder<TActor = unknown> extends ConstructionBuilder<PanelState<TActor>, CompiledPanelDefinition<TActor>> implements DiscoverableBuilder<'panel'> {
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'panel' as const

  constructor(readonly id: string) {
    assertIdentifier(id, 'Panels')
    super({
      access: () => true,
      actorPresenter: () => ({}),
      auth: null,
      branding: { favicon: null, logo: null, name: id },
      databaseNotifications: null,
      databaseNotificationInbox: null,
      defaults: [],
      defaultPanel: false,
      discover: {},
      guard: 'web',
      navigation: [],
      navigationMode: 'sidebar',
      path: `/${id}`,
      plugins: [],
      sidebarCollapsible: true,
      slots: {},
      theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'constrained' },
      tenancy: null,
      userMenu: [],
    })
  }

  get route(): string {
    return this.readState().path
  }

  get guardName(): string {
    return this.readState().guard
  }

  get discover(): Readonly<DiscoveryDirectories> {
    return Object.freeze({ ...this.readState().discover })
  }

  get client(): Readonly<Record<string, string>> {
    return Object.freeze({ path: this.readState().path })
  }

  path(value: string): this {
    return this.writeState('path', panelPath(value))
  }

  guard(value: string): this {
    assertIdentifier(value, 'Panel guards')
    return this.writeState('guard', value)
  }

  defaultPanel(value = true): this {
    return this.writeState('defaultPanel', value)
  }

  ['default'](value = true): this {
    return this.defaultPanel(value)
  }

  access(policy: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>): this {
    return this.writeState('access', policy)
  }

  auth<
    TProfileValues extends Readonly<Record<string, unknown>>,
    TProfileField extends Extract<keyof TProfileValues, string>,
    TTenantSource extends RuntimeTypeSource,
    TServicesSource extends RuntimeTypeSource,
  >(
    sources: {
      readonly services: TServicesSource
      readonly tenant: TTenantSource
    },
    options: PanelAuthPageConfiguration<
      TProfileValues,
      TProfileField,
      TActor,
      RuntimeTypeValue<TTenantSource>,
      RuntimeTypeValue<TServicesSource>
    >,
  ): this
  auth<
    TProfileValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>,
    TProfileField extends Extract<keyof TProfileValues, string> = Extract<keyof TProfileValues, string>,
    TTenant = unknown,
    TServices = unknown,
  >(
    options: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, TTenant, TServices>,
  ): this
  auth<
    TProfileValues extends Readonly<Record<string, unknown>>,
    TProfileField extends Extract<keyof TProfileValues, string>,
    TTenant,
    TServices,
  >(
    optionsOrSources: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, TTenant, TServices> | {
      readonly services: RuntimeTypeSource
      readonly tenant: RuntimeTypeSource
    },
    profileOptions?: PanelAuthPageConfiguration<TProfileValues, TProfileField, TActor, TTenant, TServices>,
  ): this {
    const options = profileOptions ?? optionsOrSources as PanelAuthPageConfiguration<
      TProfileValues,
      TProfileField,
      TActor,
      TTenant,
      TServices
    >
    if (this.readState().auth !== null) throw new Error('Panel authentication pages are already configured')
    return this.writeState('auth', path => compilePanelAuth(options, {
      panelPath: path,
      route: (value, label) => destinationPath(value, path, label),
    }))
  }

  presentActor(presenter: PanelActorPresenter<TActor>): this {
    return this.writeState('actorPresenter', presenter)
  }

  plugin<TTenant = unknown>(plugin: PanelPlugin<TActor, TTenant>): this {
    assertIdentifier(plugin.id, 'Panel plugins')
    if (!PACKAGE_NAME.test(plugin.packageName) || plugin.packageName.length > 214) throw new Error('Panel plugins require a valid npm package name')
    if (!plugin.compatibility?.panels || !plugin.compatibility.protocol) throw new Error('Panel plugins require compatibility metadata')
    if (typeof plugin.install !== 'function') throw new TypeError('Panel plugins require an install method')
    if (this.readState().plugins.some(registered => registered.id === plugin.id)) {
      throw new Error(`Panel plugin "${plugin.id}" is already registered`)
    }
    return this.writeState('plugins', [...this.readState().plugins, plugin])
  }

  defaults(...defaults: readonly ComponentDefault[]): this {
    return this.writeState('defaults', [...this.readState().defaults, ...defaults])
  }

  slot(slot: PanelRenderSlot, reference: string | RenderSlotReference): this {
    return this.writeState('slots', appendScopedRenderSlot(this.readState().slots, slot, reference, 'panel'))
  }

  tenancy<
    TTenantSource extends RuntimeTypeSource,
    TTenantId extends PanelTenantIdentifier,
    TRegistrationValues extends Readonly<Record<string, unknown>>,
    TProfileValues extends Readonly<Record<string, unknown>>,
  >(
    options: PanelTenancyOptions<
      TActor,
      RuntimeTypeValue<TTenantSource>,
      TTenantId,
      TTenantSource,
      TRegistrationValues,
      TProfileValues
    >,
  ): this {
    if (this.readState().tenancy !== null) throw new Error('Panel tenancy is already configured')
    return this.writeState('tenancy', compilePanelTenancy(options))
  }

  databaseNotifications(options: Partial<PanelDatabaseNotificationConfiguration> = {}): this {
    return this.writeState('databaseNotifications', databaseNotificationConfiguration(options))
  }

  databaseNotificationInbox(options: PanelDatabaseNotificationInboxOptions<TActor>): this {
    if (typeof options.resolve !== 'function' || typeof options.authorize !== 'function') {
      throw new Error('Database notification inboxes require identity resolution and authorization')
    }
    const authorize = options.authorize
    const resolve = options.resolve
    const inbox: PanelDatabaseNotificationInboxOptions<TActor> = {
      authorize: (operation, scope) => authorize(operation, scope),
      resolve: scope => resolve(scope),
    }
    return this.writeState('databaseNotificationInbox', Object.freeze(inbox))
  }

  branding(value: { readonly favicon?: string | null, readonly logo?: string | null, readonly name?: string }): this {
    const current = this.readState().branding
    const branding = { ...current, ...value }
    if (!branding.name.trim()) throw new Error('Panel brand names cannot be empty')
    return this.writeState('branding', {
      favicon: brandingUrl(branding.favicon, 'Panel favicons'),
      logo: brandingUrl(branding.logo, 'Panel logos'),
      name: branding.name.trim(),
    })
  }

  theme(value: Partial<PanelTheme>): this {
    return this.writeState('theme', { ...this.readState().theme, ...value, colors: value.colors ?? this.readState().theme.colors })
  }

  navigationMode(value: PanelNavigationMode): this {
    return this.writeState('navigationMode', value)
  }

  collapsibleSidebar(value = true): this {
    return this.writeState('sidebarCollapsible', value)
  }

  navigation(items: readonly PanelNavigationSeed[]): this {
    const serialized = toJsonValue(items)
    if (!Array.isArray(serialized)) throw new TypeError('Panel navigation must be JSON-safe')
    return this.writeState('navigation', items.map(item => ({ ...item })))
  }

  userMenu(items: readonly PanelUserMenuItem[]): this {
    const ids = new Set<string>()
    for (const item of items) {
      assertIdentifier(item.id, 'User menu items')
      if (ids.has(item.id)) throw new Error(`Duplicate user menu item "${item.id}"`)
      ids.add(item.id)
    }
    toJsonValue(items)
    return this.writeState('userMenu', [...items])
  }

  discoverResources(path = 'resources'): this {
    return this.writeDiscovery('resources', path)
  }

  discoverPages(path = 'pages'): this {
    return this.writeDiscovery('pages', path)
  }

  discoverWidgets(path = 'widgets'): this {
    return this.writeDiscovery('widgets', path)
  }

  discoverClusters(path = 'clusters'): this {
    return this.writeDiscovery('clusters', path)
  }

  compileDiscoveryDefinition(): DiscoverableDefinition<'panel', PanelDiscoveryServer> {
    const definition = this.compile()
    return Object.freeze({
      client: { path: definition.manifest.path },
      default: definition.manifest.default,
      discover: definition.discover,
      discoveryMarker: this.discoveryMarker,
      id: this.id,
      kind: this.kind,
      navigationKeys: definition.manifest.navigation.map(item => item.id),
      route: definition.manifest.path,
      server: {
        plugins: definition.server.plugins.map(plugin => ({
          compatibility: plugin.compatibility,
          contributions: plugin.contributions,
          id: plugin.id,
          packageName: plugin.packageName,
        })),
      },
    })
  }

  protected createDefinition(state: Readonly<PanelState<TActor>>): CompiledPanelDefinition<TActor> {
    const auth = state.auth?.(state.path) ?? null
    const navigation = state.navigation.map(item => ({ ...item, path: destinationPath(item.path, state.path, `Panel navigation item "${item.id}"`) }))
    const userMenu = state.userMenu.map(item => ({ ...item, path: destinationPath(item.path, state.path, `User menu item "${item.id}"`) }))
    const manifest = {
      auth: auth?.manifest ?? null,
      branding: state.branding,
      databaseNotifications: state.databaseNotifications,
      default: state.defaultPanel,
      id: this.id,
      navigation,
      navigationMode: state.navigationMode,
      path: state.path,
      sidebarCollapsible: state.sidebarCollapsible,
      slots: state.slots,
      theme: state.theme,
      tenancy: state.tenancy === null ? null : {
        enabled: true as const,
        ...(state.tenancy.profilePath === undefined ? {} : {
          profile: { path: destinationPath(state.tenancy.profilePath, state.path, 'Panel tenant profile path') },
        }),
        ...(state.tenancy.registrationPath === undefined ? {} : {
          registration: { path: destinationPath(state.tenancy.registrationPath, state.path, 'Panel tenant registration path') },
        }),
      },
      userMenu,
    }
    toJsonValue(manifest)
    const notifications = state.databaseNotificationInbox === null ? {} : { notifications: { inbox: state.databaseNotificationInbox } }
    const authServer = auth === null ? {} : { auth: auth.server }
    const plugins = state.plugins.map(plugin => this.installPlugin(plugin, state.guard))
    const tenancy = state.tenancy === null ? {} : { tenancy: state.tenancy }
    return {
      discover: state.discover,
      guard: state.guard,
      kind: 'panel',
      manifest,
      server: { access: state.access, defaults: state.defaults, plugins, presentActor: state.actorPresenter, ...authServer, ...notifications, ...tenancy },
    }
  }

  private installPlugin(plugin: PanelPlugin<TActor>, guard: string): PreparedPanelPluginInstallation<TActor> {
    const installation = plugin.install(Object.freeze({ guard, id: this.id }))
    if (installation.id !== plugin.id) throw new Error(`Panel plugin "${plugin.id}" must install with the same ID`)
    assertIdentifier(installation.id, 'Panel plugin installations')
    if (installation.permissionNamespace !== null) assertIdentifier(installation.permissionNamespace, 'Panel plugin permission namespaces')
    const authorizationLayer = installation.authorizationLayer
    if (authorizationLayer !== null) {
      assertIdentifier(authorizationLayer.id, 'Panel authorization layers')
      if (typeof authorizationLayer.authorize !== 'function') throw new TypeError('Panel authorization layers require an authorize method')
    }
    if (!Array.isArray(installation.contributions)) throw new TypeError('Panel plugin installations require contributions')
    return Object.freeze({
      authorizationLayer,
      compatibility: plugin.compatibility,
      contributions: Object.freeze([...installation.contributions]),
      id: installation.id,
      packageName: plugin.packageName,
      permissionNamespace: installation.permissionNamespace,
    })
  }

  private writeDiscovery(key: keyof DiscoveryDirectories, path: string): this {
    const normalized = path.trim().replace(/^\.\//u, '')
    if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('Discovery directories must be panel-relative')
    return this.writeState('discover', { ...this.readState().discover, [key]: normalized })
  }
}

export interface PanelActorSource<TActor extends object> {
  readonly prototype: TActor
}

export function definePanel<TActor extends object>(id: string, actor: PanelActorSource<TActor>): PanelBuilder<TActor>
export function definePanel(id: string): PanelBuilder<unknown>
export function definePanel<TActor = unknown>(id: string, _actor?: PanelActorSource<TActor & object>): PanelBuilder<TActor> {
  return new PanelBuilder(id)
}
