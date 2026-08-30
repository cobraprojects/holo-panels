import { ConstructionBuilder } from '../builders/construction-builder'
import { compilePanelAuth } from '../auth/compile'
import type {
  CompiledPanelAuth,
  PanelAuthPageConfiguration,
  PanelEmailChangeVerificationPageConfiguration,
  PanelEmailVerificationPageConfiguration,
  PanelLoginPageConfiguration,
  PanelMultiFactorPageConfiguration,
  PanelPasswordResetPageConfiguration,
  PanelRegistrationPageConfiguration,
} from '../auth/contracts'
import type { ComponentDefault } from '../defaults/component-default'
import { DISCOVERY_MARKER, type DiscoverableBuilder, type DiscoverableDefinition, type DiscoveryDirectories } from '../discovery/types'
import type { PluginCompatibility } from '../plugins/compatibility'
import type { PanelPlugin, PanelPluginInstallation } from '../plugins/panel-plugin'
import type { JsonObject } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import { normalizePanelLocaleConfiguration } from '../translations/panel-locale'
import type { RenderSlotReference } from '../schemas/contracts'
import { defineSchema } from '../schemas/builder'
import type { RecordTypeSource, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import { compilePanelTenancy } from '../tenancy/compiled'
import type {
  CompiledPanelTenancy,
  PanelModelTenancyOptions,
  PanelTenancyOptions,
  PanelTenantBillingProvider,
  PanelTenantIdentifier,
  PanelTenantMenuItem,
} from '../tenancy/contracts'
import type {
  CompiledPanelDefinition,
  PanelAccessContext,
  PanelAuthenticatedScope,
  PanelActorPresenter,
  PanelBranding,
  PanelBootContext,
  PanelAsset,
  PanelComponentConfiguration,
  PanelContentWidth,
  PanelDatabaseNotificationConfiguration,
  PanelDatabaseNotificationInboxOptions,
  PanelNavigationMode,
  PanelMiddleware,
  PanelNavigationGroup,
  PanelNavigationSeed,
  PanelRegisteredDefinition,
  PanelRouteMethod,
  PanelRouteRegistrar,
  PanelRouteScope,
  PanelTheme,
  PanelSubNavigationPosition,
  PanelTokenTheme,
  PanelUserMenuItem,
} from './contracts'
import { compilePanelRoutes } from './routes'
import { appendScopedRenderSlot, type RenderHook, type ScopedRenderSlots } from './render-slots'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/u

interface PanelState<TActor> {
  access: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>
  actorHidden: readonly string[]
  actorPresenter: PanelActorPresenter<TActor>
  actorRecipientType: string
  auth: ((path: string) => CompiledPanelAuth<TActor>) | null
  authFeatures: PanelAuthPageConfiguration<Readonly<Record<string, unknown>>, string, TActor, unknown, unknown>
  authPasswordBroker: string
  authRoutes: {
    emailChangeVerificationPrefix: string | null
    emailChangeVerificationSlug: string | null
    emailVerificationPrefix: string | null
    emailVerificationPromptSlug: string | null
    emailVerificationSlug: string | null
    loginSlug: string | null
    passwordResetPrefix: string | null
    passwordResetRequestSlug: string | null
    passwordResetSlug: string | null
    registrationSlug: string | null
  }
  assets: readonly PanelAsset[]
  boot: readonly ((panel: PanelBootContext) => void | Promise<void>)[]
  branding: PanelBranding
  components: PanelComponentConfiguration
  databaseNotifications: PanelDatabaseNotificationConfiguration | null
  databaseNotificationInbox: PanelDatabaseNotificationInboxOptions<TActor> | null
  defaults: readonly ComponentDefault[]
  defaultPanel: boolean
  discover: DiscoveryDirectories
  guard: string
  globalSearch: boolean
  globalSearchDebounce: number
  globalSearchFieldSuffix: string | null
  globalSearchKeybindingSuffix: string | null
  globalSearchKeybindings: readonly string[]
  globalSearchResourceOptIn: boolean
  icons: JsonObject
  id: string
  layout: {
    breadcrumbs: boolean
    collapsedSidebarWidth: string
    collapsibleNavigationGroups: boolean
    maxContentWidth: PanelContentWidth
    sidebarFullyCollapsible: boolean
    sidebarWidth: string
    simplePageMaxContentWidth: PanelContentWidth
    subNavigationPosition: PanelSubNavigationPosition
    topbar: boolean
  }
  locales: {
    allowed: readonly string[]
    fallback: string
  }
  middleware: {
    authenticated: readonly PanelMiddleware<TActor>[]
    panel: readonly PanelMiddleware<TActor>[]
    persistent: {
      authenticated: readonly PanelMiddleware<TActor>[]
      panel: readonly PanelMiddleware<TActor>[]
      tenant: readonly PanelMiddleware<TActor>[]
    }
    tenant: readonly PanelMiddleware<TActor>[]
  }
  navigation: PanelNavigationSeed[]
  navigationEnabled: boolean
  navigationGroups: readonly PanelNavigationGroup[]
  navigationMode: PanelNavigationMode
  path: string
  routing: {
    domain: string | null
    domains: readonly string[]
    homeUrl: string | null
  }
  runtime: {
    broadcasting: boolean
    databaseTransactions: boolean
    readOnlyRelationManagersOnResourceViewPagesByDefault: boolean
    resourceCreatePageRedirect: 'edit' | 'index' | 'view'
    resourceEditPageRedirect: 'index' | 'view' | null
    spa: boolean
    spaPrefetching: boolean
    spaUrlExceptions: readonly string[]
    strictAuthorization: boolean
    unsavedChangesAlerts: boolean
  }
  routes: Record<PanelRouteScope, readonly PanelRouteRegistrar[]>
  plugins: readonly PanelPlugin<TActor>[]
  registered: readonly PanelRegisteredDefinition[]
  sidebarCollapsible: boolean
  slots: ScopedRenderSlots<RenderHook>
  theme: PanelTheme
  tenancy: {
    compile: (resolver: PanelTenantResolver<TActor> | null) => CompiledPanelTenancy<TActor>
  } | null
  tenancyConfiguration: {
    billingProvider: PanelTenantBillingProvider<TActor> | null
    billingRouteSlug: string
    menu: boolean
    menuItems: readonly PanelTenantMenuItem[]
    profilePath: string | null | undefined
    registrationPath: string | null | undefined
    requiresSubscription: boolean
    resolveTenantUsing: PanelTenantResolver<TActor> | null
    routeDomain: string | null
    routePrefix: string | null
    searchableMenu: boolean | null
    switcher: boolean
  }
  userMenu: PanelUserMenuItem[]
  userMenuEnabled: boolean
  errorNotifications: {
    disabledStatusCodes: readonly number[]
    enabled: boolean
    hiddenStatusCodes: readonly number[]
    notifications: readonly { readonly body: string, readonly statusCode: number | null, readonly title: string }[]
  }
}

type PanelTenantResolver<TActor> = (
  key: string,
  scope: PanelAuthenticatedScope<TActor>,
) => unknown | null | Promise<unknown | null>

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
  readonly registered: readonly PanelRegisteredDefinition[]
  readonly routeDomain: string | null
  readonly routePrefix: string | null
  readonly routes: readonly {
    readonly method: PanelRouteMethod
    readonly path: string
    readonly scope: PanelRouteScope
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

function panelTokenTheme(value: PanelTokenTheme): Partial<PanelTheme> {
  const name = value.name.trim()
  if (!name) throw new Error('Panel theme names cannot be empty')
  const tokens: Record<string, string> = {}
  for (const [token, unresolved] of Object.entries(value.tokens)) {
    if (!/^[a-z][a-z0-9-]*$/u.test(token)) throw new Error(`Panel theme token "${token}" is invalid`)
    const resolved = unresolved.trim()
    const hasUnsafeCharacter = [...resolved].some((character) => {
      const code = character.charCodeAt(0)
      return ';{}<>'.includes(character) || code <= 31 || code === 127
    })
    if (!resolved || resolved.length > 256 || hasUnsafeCharacter || /(?:expression|url)\s*\(/iu.test(resolved) || /@import|<\/style/iu.test(resolved)) {
      throw new Error(`Panel theme token "${token}" has an unsafe value`)
    }
    tokens[token] = resolved
  }
  return { darkMode: value.colorScheme, name, tokens }
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
  const lazy = options.lazy ?? true
  const component = options.component ?? null
  if (placement !== 'sidebar' && placement !== 'topbar') throw new Error('Database notification placement must be sidebar or topbar')
  if (polling !== false && (!Number.isInteger(polling) || polling < 1_000 || polling > 3_600_000)) {
    throw new Error('Database notification polling must be false or an integer between 1000 and 3600000 milliseconds')
  }
  if (typeof realtime !== 'boolean') throw new Error('Database notification realtime must be boolean')
  if (typeof lazy !== 'boolean') throw new Error('Database notification lazy loading must be boolean')
  if (component !== null && (!component.trim() || hasControlCharacter(component))) throw new Error('Database notification components require a safe component reference')
  return {
    placement,
    polling,
    realtime,
    ...(options.component === undefined ? {} : { component: component?.trim() ?? null }),
    ...(options.lazy === undefined ? {} : { lazy }),
  }
}

function hiddenActorAttributes(source: RecordTypeSource | undefined): readonly string[] {
  if (!source || !('definition' in source)) return []
  const definition = source.definition
  if (typeof definition !== 'object' || definition === null || !('hidden' in definition) || !Array.isArray(definition.hidden)) return []
  return definition.hidden.filter((key): key is string => typeof key === 'string')
}

function actorRecipientType(source: RecordTypeSource | undefined): string {
  if (!source || !('definition' in source)) return 'users'
  const definition = source.definition
  if (typeof definition !== 'object' || definition === null || !('table' in definition)) return 'users'
  const table = Reflect.get(definition, 'table')
  if (typeof table !== 'object' || table === null) return 'users'
  const tableName = Reflect.get(table, 'tableName')
  return typeof tableName === 'string' && tableName.trim() ? tableName.trim() : 'users'
}

function defaultActorPresenter<TActor>(source: RecordTypeSource | undefined): PanelActorPresenter<TActor> {
  if (!source || !('definition' in source)) return () => ({})
  const definition = source.definition
  const table = typeof definition === 'object' && definition !== null && 'table' in definition ? Reflect.get(definition, 'table') : null
  const columns = typeof table === 'object' && table !== null && 'columns' in table ? Reflect.get(table, 'columns') : null
  const attributes = typeof columns === 'object' && columns !== null ? new Set(Object.keys(columns)) : null
  return actor => {
    const serialized = typeof actor === 'object' && actor !== null && 'toJSON' in actor && typeof actor.toJSON === 'function'
      ? actor.toJSON()
      : actor
    const selected = typeof serialized === 'object' && serialized !== null && !Array.isArray(serialized) && attributes !== null
      ? Object.fromEntries(Object.entries(serialized).filter(([key]) => attributes.has(key)))
      : serialized
    const value = toJsonValue(normalizeActorSerialization(selected))
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value
  }
}

function normalizeActorSerialization(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(item => normalizeActorSerialization(item))
  if (typeof value !== 'object' || value === null || Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeActorSerialization(item)]))
}

function projectActor(value: JsonObject, hidden: readonly string[]): JsonObject {
  if (hidden.includes('*')) return {}
  const projected = { ...value }
  for (const key of hidden) delete projected[key]
  return projected
}

function modelAttribute(value: unknown, attribute: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  if (attribute in value) return Reflect.get(value, attribute)
  if ('get' in value && typeof value.get === 'function') return value.get(attribute)
  return undefined
}

function actorRelationship(actor: unknown, relationship: string): unknown {
  if (typeof actor !== 'object' || actor === null) return undefined
  if (relationship in actor) return Reflect.get(actor, relationship)
  if ('getRelation' in actor && typeof actor.getRelation === 'function') return Reflect.apply(actor.getRelation, actor, [relationship])
  return undefined
}

async function reloadActorRelationship(actorSource: RecordTypeSource, identifier: string | number, relationship: string): Promise<unknown> {
  if ('with' in actorSource && typeof actorSource.with === 'function') {
    const query = Reflect.apply(actorSource.with, actorSource, [relationship]) as unknown
    if (typeof query === 'object' && query !== null && 'find' in query && typeof query.find === 'function') {
      return query.find(identifier)
    }
  }
  if (!('find' in actorSource) || typeof actorSource.find !== 'function') return null
  const resolved = await actorSource.find(identifier)
  if (typeof resolved === 'object' && resolved !== null && 'load' in resolved && typeof resolved.load === 'function') {
    await Reflect.apply(resolved.load, resolved, [relationship])
  }
  return resolved
}

async function actorTenantMemberships<TActor, TTenant>(actor: TActor, relationship: string, actorSource?: RecordTypeSource): Promise<readonly TTenant[]> {
  let resolvedActor: unknown = actor
  let relation = actorRelationship(resolvedActor, relationship)
  if (typeof relation === 'undefined') {
    const identifier = modelAttribute(actor, String(actorSource ? modelDefinitionValue(actorSource, 'primaryKey') ?? 'id' : 'id'))
    if (actorSource && (typeof identifier === 'string' || typeof identifier === 'number')) {
      resolvedActor = await reloadActorRelationship(actorSource, identifier, relationship)
      relation = actorRelationship(resolvedActor, relationship)
    }
  }
  if (typeof relation === 'undefined') return Object.freeze([])
  const resolved = typeof relation === 'function' ? await Reflect.apply(relation, resolvedActor, []) : await relation
  if (Array.isArray(resolved)) return Object.freeze([...resolved] as TTenant[])
  if (typeof resolved === 'object' && resolved !== null && Symbol.iterator in resolved) {
    return Object.freeze(Array.from(resolved as Iterable<TTenant>))
  }
  if (typeof resolved === 'object' && resolved !== null && 'all' in resolved && typeof resolved.all === 'function') {
    const values = await resolved.all()
    return Array.isArray(values) ? Object.freeze([...values] as TTenant[]) : Object.freeze([])
  }
  return Object.freeze([])
}

function modelDefinitionValue(source: RuntimeTypeSource, key: string): unknown {
  if (!('definition' in source) || typeof source.definition !== 'object' || source.definition === null) return undefined
  return Reflect.get(source.definition, key)
}

function modelColumnNames(source: RuntimeTypeSource): readonly string[] {
  const table = modelDefinitionValue(source, 'table')
  if (typeof table !== 'object' || table === null) return Object.freeze([])
  const columns = Reflect.get(table, 'columns')
  return typeof columns === 'object' && columns !== null ? Object.freeze(Object.keys(columns)) : Object.freeze([])
}

function modelTableName(source: RuntimeTypeSource): string {
  const table = modelDefinitionValue(source, 'table')
  const tableName = typeof table === 'object' && table !== null ? Reflect.get(table, 'tableName') : undefined
  return typeof tableName === 'string' && tableName.trim() ? tableName.trim() : 'tenants'
}

function tenantIdentifier(value: unknown, label: string): PanelTenantIdentifier {
  if ((typeof value !== 'string' && typeof value !== 'number') || typeof value === 'string' && !value.trim() || typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${label} must resolve to a string or number`)
  }
  return value
}

function pollingMilliseconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h)$/u.exec(value.trim())
  if (!match) throw new Error('Database notification polling intervals use ms, s, m, or h units')
  const amount = Number(match[1])
  const multiplier = match[2] === 'ms' ? 1 : match[2] === 's' ? 1_000 : match[2] === 'm' ? 60_000 : 3_600_000
  const milliseconds = amount * multiplier
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1_000 || milliseconds > 3_600_000) {
    throw new Error('Database notification polling intervals must be between 1s and 1h')
  }
  return milliseconds
}

type ExplicitPanelKind = 'cluster' | 'page' | 'resource' | 'widget'
type ExplicitPanelDefinition<TKind extends ExplicitPanelKind> = DiscoverableBuilder<TKind> | DiscoverableDefinition<TKind>

function compileRegistered<TKind extends ExplicitPanelKind>(
  kind: TKind,
  values: readonly ExplicitPanelDefinition<TKind>[],
): readonly PanelRegisteredDefinition[] {
  return values.map(value => {
    const definition = 'compileDiscoveryDefinition' in value ? value.compileDiscoveryDefinition() : value
    if (definition.kind !== kind || definition.discoveryMarker !== DISCOVERY_MARKER) {
      throw new Error(`Panel ${kind} registrations require discoverable ${kind} definitions`)
    }
    const compiled = 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
    return Object.freeze({ definition, value: compiled })
  })
}

export class PanelBuilder<TActor = unknown> extends ConstructionBuilder<PanelState<TActor>, CompiledPanelDefinition<TActor>> {
  readonly #actorSource?: RecordTypeSource
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'panel' as const

  constructor(initialId: string, actorSource?: RecordTypeSource) {
    assertIdentifier(initialId, 'Panels')
    super({
      access: () => true,
      actorHidden: hiddenActorAttributes(actorSource),
      actorPresenter: defaultActorPresenter<TActor>(actorSource),
      actorRecipientType: actorRecipientType(actorSource),
      auth: null,
      authFeatures: {},
      authPasswordBroker: 'users',
      authRoutes: {
        emailChangeVerificationPrefix: null,
        emailChangeVerificationSlug: null,
        emailVerificationPrefix: null,
        emailVerificationPromptSlug: null,
        emailVerificationSlug: null,
        loginSlug: null,
        passwordResetPrefix: null,
        passwordResetRequestSlug: null,
        passwordResetSlug: null,
        registrationSlug: null,
      },
      assets: [],
      boot: [],
      branding: { avatarProvider: null, darkModeLogo: null, favicon: null, logo: null, logoHeight: null, name: initialId },
      components: { sidebar: null, topbar: null },
      databaseNotifications: null,
      databaseNotificationInbox: null,
      defaults: [],
      defaultPanel: false,
      discover: {},
      guard: 'web',
      globalSearch: true,
      globalSearchDebounce: 500,
      globalSearchFieldSuffix: null,
      globalSearchKeybindingSuffix: null,
      globalSearchKeybindings: ['meta+k', 'ctrl+k'],
      globalSearchResourceOptIn: false,
      icons: {},
      id: initialId,
      layout: {
        breadcrumbs: true,
        collapsedSidebarWidth: '4.5rem',
        collapsibleNavigationGroups: true,
        maxContentWidth: '7xl',
        sidebarFullyCollapsible: false,
        sidebarWidth: '20rem',
        simplePageMaxContentWidth: 'lg',
        subNavigationPosition: 'start',
        topbar: true,
      },
      locales: { allowed: ['en', 'ar'], fallback: 'en' },
      middleware: { authenticated: [], panel: [], persistent: { authenticated: [], panel: [], tenant: [] }, tenant: [] },
      navigation: [],
      navigationEnabled: true,
      navigationGroups: [],
      navigationMode: 'sidebar',
      path: `/${initialId}`,
      routing: { domain: null, domains: [], homeUrl: null },
      routes: { authenticated: [], 'authenticated-tenant': [], public: [], tenant: [] },
      runtime: {
        broadcasting: true,
        databaseTransactions: false,
        readOnlyRelationManagersOnResourceViewPagesByDefault: true,
        resourceCreatePageRedirect: 'edit',
        resourceEditPageRedirect: null,
        spa: true,
        spaPrefetching: false,
        spaUrlExceptions: [],
        strictAuthorization: false,
        unsavedChangesAlerts: false,
      },
      plugins: [],
      registered: [],
      sidebarCollapsible: true,
      slots: {},
      theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, monoFontFamily: null, serifFontFamily: null, switcher: true, width: 'constrained' },
      tenancy: null,
      tenancyConfiguration: {
        billingProvider: null,
        billingRouteSlug: 'billing',
        menu: true,
        menuItems: [],
        profilePath: undefined,
        registrationPath: undefined,
        requiresSubscription: false,
        resolveTenantUsing: null,
        routeDomain: null,
        routePrefix: null,
        searchableMenu: null,
        switcher: true,
      },
      userMenu: [],
      userMenuEnabled: true,
      errorNotifications: { disabledStatusCodes: [], enabled: true, hiddenStatusCodes: [], notifications: [] },
    })
    this.#actorSource = actorSource
  }

  get route(): string {
    return this.readState().path
  }

  id(value: string): this {
    assertIdentifier(value, 'Panels')
    const current = this.readState()
    const usesDefaultPath = current.path === `/${current.id}`
    const usesDefaultBrandName = current.branding.name === current.id
    this.writeState('id', value)
    if (usesDefaultPath) this.writeState('path', `/${value}`)
    if (usesDefaultBrandName) this.writeState('branding', { ...current.branding, name: value })
    return this
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

  authGuard(value: string): this {
    return this.guard(value)
  }

  defaultPanel(value = true): this {
    return this.writeState('defaultPanel', value)
  }

  locales(values: readonly string[]): this {
    const currentFallback = this.readState().locales.fallback
    let configuration: ReturnType<typeof normalizePanelLocaleConfiguration>
    try {
      configuration = normalizePanelLocaleConfiguration(values, currentFallback)
    } catch {
      configuration = normalizePanelLocaleConfiguration(values, values[0] ?? '')
    }
    return this.writeState('locales', configuration)
  }

  defaultLocale(value: string): this {
    const configuration = normalizePanelLocaleConfiguration(this.readState().locales.allowed, value)
    return this.writeState('locales', configuration)
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

  login(configuration: boolean | PanelLoginPageConfiguration = true): this {
    this.writeAuthFeature('login', configuration)
    return this.writeAuthFeature('logout', true)
  }

  loginRouteSlug(value: string): this {
    return this.writeAuthRoute('loginSlug', value)
  }

  registration(configuration: boolean | PanelRegistrationPageConfiguration = true): this {
    return this.writeAuthFeature('registration', configuration)
  }

  registrationRouteSlug(value: string): this {
    return this.writeAuthRoute('registrationSlug', value)
  }

  passwordReset(configuration: Omit<PanelPasswordResetPageConfiguration, 'broker'> = {}): this {
    return this.writeAuthFeature('passwordReset', { ...configuration, broker: this.readState().authPasswordBroker })
  }

  passwordResetRoutePrefix(value: string): this {
    return this.writeAuthRoute('passwordResetPrefix', value)
  }

  passwordResetRequestRouteSlug(value: string): this {
    return this.writeAuthRoute('passwordResetRequestSlug', value)
  }

  passwordResetRouteSlug(value: string): this {
    return this.writeAuthRoute('passwordResetSlug', value)
  }

  emailVerification(configuration: boolean | PanelEmailVerificationPageConfiguration = true): this {
    return this.writeAuthFeature('emailVerification', configuration)
  }

  emailVerificationRoutePrefix(value: string): this {
    return this.writeAuthRoute('emailVerificationPrefix', value)
  }

  emailVerificationPromptRouteSlug(value: string): this {
    return this.writeAuthRoute('emailVerificationPromptSlug', value)
  }

  emailVerificationRouteSlug(value: string): this {
    return this.writeAuthRoute('emailVerificationSlug', value)
  }

  emailChangeVerification(configuration: boolean | PanelEmailChangeVerificationPageConfiguration = true): this {
    return this.writeAuthFeature('emailChangeVerification', configuration)
  }

  emailChangeVerificationRoutePrefix(value: string): this {
    return this.writeAuthRoute('emailChangeVerificationPrefix', value)
  }

  emailChangeVerificationRouteSlug(value: string): this {
    return this.writeAuthRoute('emailChangeVerificationSlug', value)
  }

  revealablePasswords(value = true): this {
    return this.writeAuthFeature('revealablePasswords', value)
  }

  profile(configuration: PanelState<TActor>['authFeatures']['profile'] = true): this {
    return this.writeAuthFeature('profile', configuration)
  }

  simpleProfilePage(value = true): this {
    return this.profile(value)
  }

  multiFactorAuthentication(configuration: boolean | PanelMultiFactorPageConfiguration = true): this {
    return this.writeAuthFeature('multiFactor', configuration)
  }

  authPasswordBroker(value: string): this {
    const broker = value.trim()
    if (!broker) throw new Error('Panel password brokers cannot be empty')
    const passwordReset = this.readState().authFeatures.passwordReset
    const next = passwordReset
      ? { ...this.readState().authFeatures, passwordReset: { ...passwordReset, broker } }
      : this.readState().authFeatures
    this.writeState('authFeatures', next)
    return this.writeState('authPasswordBroker', broker)
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
    return this.writeState('tenancy', {
      compile: resolver => compilePanelTenancy({
        ...options,
        ...(resolver === null ? {} : {
          resolveTenantUsing: async (key, scope) => await resolver(key, scope) as RuntimeTypeValue<TTenantSource> | null,
        }),
      }),
    })
  }

  tenant<TTenantSource extends RuntimeTypeSource>(
    model: TTenantSource & (RuntimeTypeValue<TTenantSource> extends object ? object : never),
    options: PanelModelTenancyOptions<TActor, RuntimeTypeValue<TTenantSource>> = {},
  ): this {
    return this.tenancy(this.modelTenancyOptions(model, options))
  }

  tenantRoutePrefix(prefix: string | null): this {
    const value = prefix === null ? null : this.routeSegment(prefix, 'Panel tenant route prefixes')
    return this.writeTenancyConfiguration('routePrefix', value)
  }

  tenantDomain(domain: string | null): this {
    const candidate = domain?.trim().toLowerCase() ?? null
    const tenantParameters = candidate?.match(/\{tenant(?::[a-z][a-z0-9_]*)?\}/gu) ?? []
    const value = candidate === null
      ? null
      : (this.hostname(candidate.replace(/\{tenant(?::[a-z][a-z0-9_]*)?\}/gu, 'tenant'), 'Panel tenant domains'), candidate)
    if (value !== null && tenantParameters.length !== 1) {
      throw new Error('Panel tenant domains require exactly one tenant route parameter')
    }
    return this.writeTenancyConfiguration('routeDomain', value)
  }

  tenantSwitcher(condition = true): this {
    return this.writeTenancyConfiguration('switcher', condition)
  }

  searchableTenantMenu(condition: boolean | null = true): this {
    return this.writeTenancyConfiguration('searchableMenu', condition)
  }

  tenantMenu(condition = true): this {
    return this.writeTenancyConfiguration('menu', condition)
  }

  tenantMenuItems(items: readonly PanelTenantMenuItem[]): this {
    const ids = new Set(this.readState().tenancyConfiguration.menuItems.map(item => item.id))
    for (const item of items) {
      assertIdentifier(item.id, 'Tenant menu items')
      if (ids.has(item.id)) throw new Error(`Duplicate tenant menu item "${item.id}"`)
      ids.add(item.id)
    }
    toJsonValue(items)
    return this.writeTenancyConfiguration('menuItems', [
      ...this.readState().tenancyConfiguration.menuItems,
      ...items.map(item => Object.freeze({ ...item })),
    ])
  }

  tenantProfile(page: string | null = 'tenant/profile'): this {
    const value = page === null ? null : this.staticRoute(page, 'Panel tenant profile paths')
    return this.writeTenancyConfiguration('profilePath', value)
  }

  tenantRegistration(page: string | null = 'tenant/register'): this {
    const value = page === null ? null : this.staticRoute(page, 'Panel tenant registration paths')
    return this.writeTenancyConfiguration('registrationPath', value)
  }

  tenantBillingProvider(provider: PanelTenantBillingProvider<TActor> | null): this {
    if (provider !== null && (typeof provider.getRouteAction !== 'function' || typeof provider.getSubscribedMiddleware !== 'function')) {
      throw new TypeError('Panel tenant billing providers require getRouteAction and getSubscribedMiddleware methods')
    }
    return this.writeTenancyConfiguration('billingProvider', provider)
  }

  tenantBillingRouteSlug(slug: string): this {
    return this.writeTenancyConfiguration('billingRouteSlug', this.routeSegment(slug, 'Panel tenant billing route slugs'))
  }

  requiresTenantSubscription(condition = true): this {
    return this.writeTenancyConfiguration('requiresSubscription', condition)
  }

  resolveTenantUsing<TTenant>(
    callback: (key: string, scope: PanelAuthenticatedScope<TActor>) => TTenant | null | Promise<TTenant | null>,
  ): this {
    if (typeof callback !== 'function') throw new TypeError('Panel tenant resolvers must be functions')
    return this.writeTenancyConfiguration('resolveTenantUsing', callback)
  }

  databaseNotifications(options: Partial<PanelDatabaseNotificationConfiguration> = {}): this {
    return this.writeState('databaseNotifications', databaseNotificationConfiguration(options))
  }

  databaseNotificationsPolling(interval: string | false): this {
    const current = this.readState().databaseNotifications ?? databaseNotificationConfiguration({})
    return this.writeState('databaseNotifications', {
      ...current,
      polling: interval === false ? false : pollingMilliseconds(interval),
    })
  }

  globalSearch(value = true): this {
    return this.writeState('globalSearch', value)
  }

  globalSearchDebounce(value: number | string): this {
    const milliseconds = typeof value === 'string' ? pollingMilliseconds(value) : value
    if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 60_000) {
      throw new Error('Global search debounce must be an integer between 0 and 60000 milliseconds')
    }
    return this.writeState('globalSearchDebounce', milliseconds)
  }

  globalSearchKeyBindings(bindings: readonly string[]): this {
    const normalized = bindings.map(binding => binding.trim().toLowerCase())
    if (normalized.some(binding => !binding || !/^(?:(?:ctrl|meta|alt|shift)\+)*(?:[a-z0-9]|enter|escape)$/u.test(binding))) {
      throw new Error('Global search key bindings must use modifier+key syntax')
    }
    return this.writeState('globalSearchKeybindings', Object.freeze([...new Set(normalized)]))
  }

  globalSearchFieldSuffix(value: string | null): this {
    return this.writeState('globalSearchFieldSuffix', value?.trim() || null)
  }

  globalSearchFieldKeyBindingSuffix(value: string | null): this {
    return this.writeState('globalSearchKeybindingSuffix', value?.trim() || null)
  }

  globalSearchResourceOptIn(value = true): this {
    return this.writeState('globalSearchResourceOptIn', value)
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
      avatarProvider: branding.avatarProvider,
      darkModeLogo: branding.darkModeLogo,
      favicon: brandingUrl(branding.favicon, 'Panel favicons'),
      logo: brandingUrl(branding.logo, 'Panel logos'),
      logoHeight: branding.logoHeight,
      name: branding.name.trim(),
    })
  }

  brandName(value: string): this {
    return this.branding({ name: value })
  }

  defaultAvatarProvider(value: string | null): this {
    return this.writeState('branding', { ...this.readState().branding, avatarProvider: value === null ? null : this.componentReference(value, 'Panel avatar providers') })
  }

  brandLogo(value: string | null): this {
    return this.branding({ logo: value })
  }

  darkModeBrandLogo(value: string | null): this {
    return this.writeState('branding', { ...this.readState().branding, darkModeLogo: brandingUrl(value, 'Panel dark mode logos') })
  }

  brandLogoHeight(value: string | null): this {
    const height = value?.trim() || null
    if (height !== null && !/^\d+(?:\.\d+)?(?:px|rem|em)$/u.test(height)) throw new Error('Panel brand logo heights require a CSS length')
    return this.writeState('branding', { ...this.readState().branding, logoHeight: height })
  }

  favicon(value: string | null): this {
    return this.branding({ favicon: value })
  }

  theme(value: Partial<PanelTheme> | PanelTokenTheme): this {
    const normalized = 'colorScheme' in value ? panelTokenTheme(value) : value
    const tokens = normalized.tokens ?? this.readState().theme.tokens
    return this.writeState('theme', {
      ...this.readState().theme,
      ...normalized,
      colors: normalized.colors ?? this.readState().theme.colors,
      ...(tokens === undefined ? {} : { tokens }),
    })
  }

  colors(value: JsonObject): this {
    return this.theme({ colors: value })
  }

  icons(value: JsonObject): this {
    toJsonValue(value)
    return this.writeState('icons', Object.freeze({ ...this.readState().icons, ...value }))
  }

  viteTheme(value: string): this {
    return this.assets([{ id: 'vite-theme', src: value, type: 'css' }])
  }

  darkMode(value = true): this {
    return this.theme({ darkMode: value ? 'system' : 'light' })
  }

  defaultThemeMode(value: PanelTheme['darkMode']): this {
    return this.theme({ darkMode: value })
  }

  themeSwitcher(value = true): this {
    return this.theme({ switcher: value })
  }

  font(value: string | null): this {
    return this.theme({ fontFamily: value?.trim() || null })
  }

  monoFont(value: string | null): this {
    return this.theme({ monoFontFamily: value?.trim() || null })
  }

  serifFont(value: string | null): this {
    return this.theme({ serifFontFamily: value?.trim() || null })
  }

  navigationMode(value: PanelNavigationMode): this {
    return this.writeState('navigationMode', value)
  }

  topNavigation(value = true): this {
    return this.navigationMode(value ? 'topbar' : 'sidebar')
  }

  topbar(value: boolean | string = true): this {
    if (typeof value === 'string') return this.topbarComponent(value)
    return this.writeState('layout', { ...this.readState().layout, topbar: value })
  }

  sidebarComponent(value: string | null): this {
    return this.writeState('components', { ...this.readState().components, sidebar: value === null ? null : this.componentReference(value, 'Panel sidebar components') })
  }

  topbarComponent(value: string | null): this {
    return this.writeState('components', { ...this.readState().components, topbar: value === null ? null : this.componentReference(value, 'Panel topbar components') })
  }

  breadcrumbs(value = true): this {
    return this.writeState('layout', { ...this.readState().layout, breadcrumbs: value })
  }

  maxContentWidth(value: PanelContentWidth): this {
    return this.writeState('layout', { ...this.readState().layout, maxContentWidth: value })
  }

  simplePageMaxContentWidth(value: PanelContentWidth): this {
    return this.writeState('layout', { ...this.readState().layout, simplePageMaxContentWidth: value })
  }

  subNavigationPosition(value: PanelSubNavigationPosition): this {
    return this.writeState('layout', { ...this.readState().layout, subNavigationPosition: value })
  }

  sidebarCollapsibleOnDesktop(value = true): this {
    return this.collapsibleSidebar(value)
  }

  sidebarFullyCollapsibleOnDesktop(value = true): this {
    return this.writeState('layout', { ...this.readState().layout, sidebarFullyCollapsible: value })
  }

  collapsibleNavigationGroups(value = true): this {
    return this.writeState('layout', { ...this.readState().layout, collapsibleNavigationGroups: value })
  }

  sidebarWidth(value: string): this {
    return this.writeState('layout', { ...this.readState().layout, sidebarWidth: this.cssLength(value, 'Panel sidebar widths') })
  }

  collapsedSidebarWidth(value: string): this {
    return this.writeState('layout', { ...this.readState().layout, collapsedSidebarWidth: this.cssLength(value, 'Panel collapsed sidebar widths') })
  }

  collapsibleSidebar(value = true): this {
    return this.writeState('sidebarCollapsible', value)
  }

  navigation(value = true): this {
    return this.writeState('navigationEnabled', value)
  }

  navigationItems(items: readonly PanelNavigationSeed[]): this {
    const serialized = toJsonValue(items)
    if (!Array.isArray(serialized)) throw new TypeError('Panel navigation must be JSON-safe')
    return this.writeState('navigation', items.map(item => ({ ...item })))
  }

  navigationGroups(groups: readonly (PanelNavigationGroup | string)[]): this {
    const normalized = groups.map(group => typeof group === 'string' ? { label: group } : { ...group })
    const labels = new Set<string>()
    for (const group of normalized) {
      const label = group.label.trim()
      if (!label) throw new Error('Panel navigation groups require labels')
      if (labels.has(label)) throw new Error(`Duplicate panel navigation group "${label}"`)
      labels.add(label)
      if (group.icon !== undefined && group.icon !== null) this.componentReference(group.icon, 'Panel navigation group icons')
    }
    toJsonValue(normalized)
    return this.writeState('navigationGroups', Object.freeze(normalized.map(group => Object.freeze(group))))
  }

  userMenu(value = true): this {
    return this.writeState('userMenuEnabled', value)
  }

  userMenuItems(items: readonly PanelUserMenuItem[]): this {
    const ids = new Set<string>()
    for (const item of items) {
      assertIdentifier(item.id, 'User menu items')
      if (ids.has(item.id)) throw new Error(`Duplicate user menu item "${item.id}"`)
      ids.add(item.id)
    }
    toJsonValue(items)
    return this.writeState('userMenu', [...items])
  }

  domain(value: string | null): this {
    const domain = value === null ? null : this.hostname(value, 'Panel domains')
    return this.writeState('routing', { ...this.readState().routing, domain })
  }

  domains(values: readonly string[]): this {
    return this.writeState('routing', { ...this.readState().routing, domains: values.map(value => this.hostname(value, 'Panel domains')) })
  }

  homeUrl(value: string | null): this {
    const homeUrl = value === null ? null : destinationPath(value, this.readState().path, 'Panel home URL')
    return this.writeState('routing', { ...this.readState().routing, homeUrl })
  }

  routes(registrar: PanelRouteRegistrar | null): this {
    if (registrar === null) return this
    return this.writeRoute('public', registrar)
  }

  authenticatedRoutes(registrar: PanelRouteRegistrar | null): this {
    if (registrar === null) return this
    return this.writeRoute('authenticated', registrar)
  }

  tenantRoutes(registrar: PanelRouteRegistrar | null): this {
    if (registrar === null) return this
    return this.writeRoute('tenant', registrar)
  }

  authenticatedTenantRoutes(registrar: PanelRouteRegistrar | null): this {
    if (registrar === null) return this
    return this.writeRoute('authenticated-tenant', registrar)
  }

  assets(assets: readonly PanelAsset[]): this {
    for (const asset of assets) {
      assertIdentifier(asset.id, 'Panel assets')
      brandingUrl(asset.src, `Panel asset "${asset.id}"`)
      if (asset.type !== 'css' && asset.type !== 'js') throw new Error('Panel assets must be CSS or JavaScript')
    }
    return this.writeState('assets', [...this.readState().assets, ...assets])
  }

  bootUsing(callback: (panel: PanelBootContext) => void | Promise<void>): this {
    return this.writeState('boot', [...this.readState().boot, callback])
  }

  broadcasting(value = true): this {
    return this.writeRuntime('broadcasting', value)
  }

  spa(value: boolean | { readonly hasPrefetching?: boolean } = true): this {
    const enabled = typeof value === 'boolean' ? value : true
    this.writeRuntime('spaPrefetching', enabled && typeof value === 'object' && value.hasPrefetching === true)
    return this.writeRuntime('spa', enabled)
  }

  spaUrlExceptions(values: readonly string[]): this {
    return this.writeRuntime('spaUrlExceptions', values.map(value => value.trim()).filter(Boolean))
  }

  unsavedChangesAlerts(value = true): this {
    return this.writeRuntime('unsavedChangesAlerts', value)
  }

  databaseTransactions(value = true): this {
    return this.writeRuntime('databaseTransactions', value)
  }

  resourceCreatePageRedirect(value: 'edit' | 'index' | 'view'): this {
    return this.writeRuntime('resourceCreatePageRedirect', value)
  }

  resourceEditPageRedirect(value: 'index' | 'view' | null): this {
    return this.writeRuntime('resourceEditPageRedirect', value)
  }

  readOnlyRelationManagersOnResourceViewPagesByDefault(value = true): this {
    return this.writeRuntime('readOnlyRelationManagersOnResourceViewPagesByDefault', value)
  }

  strictAuthorization(value = true): this {
    return this.writeRuntime('strictAuthorization', value)
  }

  errorNotifications(value = true): this {
    return this.writeState('errorNotifications', { ...this.readState().errorNotifications, enabled: value })
  }

  registerErrorNotification(configuration: { readonly body: string, readonly statusCode?: number, readonly title: string }): this
  registerErrorNotification(title: string, body: string, statusCode?: number): this
  registerErrorNotification(configurationOrTitle: string | { readonly body: string, readonly statusCode?: number, readonly title: string }, body?: string, statusCode?: number): this {
    const configuration = typeof configurationOrTitle === 'string'
      ? { body: body ?? '', statusCode, title: configurationOrTitle }
      : configurationOrTitle
    const title = configuration.title.trim()
    const message = configuration.body.trim()
    if (!title || !message) throw new Error('Panel error notifications require a title and body')
    const resolvedStatusCode = configuration.statusCode ?? null
    if (resolvedStatusCode !== null) this.assertStatusCode(resolvedStatusCode)
    const notification = Object.freeze({ body: message, statusCode: resolvedStatusCode, title })
    return this.writeState('errorNotifications', {
      ...this.readState().errorNotifications,
      notifications: [...this.readState().errorNotifications.notifications, notification],
    })
  }

  hiddenErrorNotification(statusCode: number): this {
    this.assertStatusCode(statusCode)
    return this.writeState('errorNotifications', {
      ...this.readState().errorNotifications,
      hiddenStatusCodes: Object.freeze([...new Set([...this.readState().errorNotifications.hiddenStatusCodes, statusCode])]),
    })
  }

  disabledErrorNotification(statusCode: number): this {
    this.assertStatusCode(statusCode)
    return this.writeState('errorNotifications', {
      ...this.readState().errorNotifications,
      disabledStatusCodes: Object.freeze([...new Set([...this.readState().errorNotifications.disabledStatusCodes, statusCode])]),
    })
  }

  middleware(middleware: readonly PanelMiddleware<TActor>[], isPersistent = false): this {
    return this.writeMiddlewareInput('panel', middleware, isPersistent)
  }

  authMiddleware(middleware: readonly PanelMiddleware<TActor>[], isPersistent = false): this {
    return this.writeMiddlewareInput('authenticated', middleware, isPersistent)
  }

  tenantMiddleware(middleware: readonly PanelMiddleware<TActor>[], isPersistent = false): this {
    return this.writeMiddlewareInput('tenant', middleware, isPersistent)
  }

  plugins(plugins: readonly PanelPlugin<TActor>[]): this {
    return plugins.reduce((builder, plugin) => builder.plugin(plugin), this)
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

  resources(definitions: readonly ExplicitPanelDefinition<'resource'>[]): this {
    return this.register('resource', definitions)
  }

  pages(definitions: readonly ExplicitPanelDefinition<'page'>[]): this {
    return this.register('page', definitions)
  }

  widgets(definitions: readonly ExplicitPanelDefinition<'widget'>[]): this {
    return this.register('widget', definitions)
  }

  clusters(definitions: readonly ExplicitPanelDefinition<'cluster'>[]): this {
    return this.register('cluster', definitions)
  }

  renderHook(hook: RenderHook, reference: string | RenderSlotReference): this {
    return this.writeState('slots', appendScopedRenderSlot(this.readState().slots, hook, reference, 'panel'))
  }

  compileDiscoveryDefinition(): DiscoverableDefinition<'panel', PanelDiscoveryServer> {
    const definition = this.compile()
    const emailChangeVerification = definition.manifest.auth?.emailChangeVerification
    const emailVerification = definition.manifest.auth?.emailVerification
    const login = definition.manifest.auth?.login
    const multiFactor = definition.manifest.auth?.multiFactor
    const passwordReset = definition.manifest.auth?.passwordReset
    const profile = definition.manifest.auth?.profile
    const registration = definition.manifest.auth?.registration
    return Object.freeze({
      client: {
        appearance: {
          colors: definition.manifest.theme.colors,
          density: definition.manifest.theme.density,
          fontFamily: definition.manifest.theme.fontFamily,
          monoFontFamily: definition.manifest.theme.monoFontFamily ?? null,
          serifFontFamily: definition.manifest.theme.serifFontFamily ?? null,
          tokens: definition.manifest.theme.tokens ?? {},
        },
        brandingName: definition.manifest.branding.name,
        darkMode: definition.manifest.theme.darkMode,
        ...(emailChangeVerification ? { emailChangeVerificationPath: emailChangeVerification.path } : {}),
        ...(emailVerification ? { emailVerificationPath: emailVerification.path, emailVerificationVerifyPath: emailVerification.verificationPath } : {}),
        ...(passwordReset ? { forgotPasswordPath: passwordReset.requestPath } : {}),
        ...(login ? { loginPath: login.path } : {}),
        ...(multiFactor ? { mfaChallengePath: multiFactor.challengePath, mfaEnrollmentPath: multiFactor.enrollmentPath, mfaRecoveryCodesPath: multiFactor.recoveryCodesPath } : {}),
        path: definition.manifest.path,
        ...(passwordReset ? { passwordResetPath: passwordReset.resetPath } : {}),
        ...(profile ? { profilePath: profile.path } : {}),
        ...(registration ? { registrationPath: registration.path } : {}),
        simplePageMaxContentWidth: definition.manifest.layout?.simplePageMaxContentWidth ?? 'lg',
        themeColors: definition.manifest.theme.colors,
      },
      default: definition.manifest.default,
      discover: definition.discover,
      discoveryMarker: this.discoveryMarker,
      id: definition.manifest.id,
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
        registered: definition.server.registered,
        routeDomain: definition.manifest.tenancy?.routeDomain ?? null,
        routePrefix: definition.manifest.tenancy?.routePrefix ?? null,
        routes: (definition.server.routes ?? []).map(route => ({ method: route.method, path: route.path, scope: route.scope })),
      },
    })
  }

  protected createDefinition(state: Readonly<PanelState<TActor>>): CompiledPanelDefinition<TActor> {
    if (state.tenancyConfiguration.requiresSubscription && state.tenancyConfiguration.billingProvider === null) {
      throw new Error('Panels that require tenant subscriptions must configure a tenant billing provider')
    }
    const compiledTenancy = state.tenancy?.compile(state.tenancyConfiguration.resolveTenantUsing) ?? null
    const legacyAuth = state.auth?.(state.path) ?? null
    const routedAuthFeatures = this.authFeaturesWithRoutes(state)
    const authFeatures = routedAuthFeatures.profile === true
      ? { ...routedAuthFeatures, profile: this.defaultProfileConfiguration() }
      : routedAuthFeatures
    const fluentAuth = Object.keys(authFeatures).length === 0
      ? null
      : compilePanelAuth(authFeatures, {
          panelPath: state.path,
          route: (value, label) => destinationPath(value, state.path, label),
        })
    const auth = legacyAuth === null
      ? fluentAuth
      : fluentAuth === null
        ? legacyAuth
        : {
            manifest: Object.freeze(Object.fromEntries(Object.entries(legacyAuth.manifest).map(([key, value]) => [
              key,
              fluentAuth.manifest[key as keyof typeof fluentAuth.manifest] ?? value,
            ]))) as CompiledPanelAuth<TActor>['manifest'],
            server: Object.freeze({
              passwordBroker: fluentAuth.server.passwordBroker ?? legacyAuth.server.passwordBroker,
              profile: fluentAuth.server.profile ?? legacyAuth.server.profile,
            }),
          }
    const navigation = state.navigation.map(item => ({ ...item, path: destinationPath(item.path, state.path, `Panel navigation item "${item.id}"`) }))
    const userMenu = state.userMenu.map(item => ({ ...item, path: destinationPath(item.path, state.path, `User menu item "${item.id}"`) }))
    const tenantMenuItems = state.tenancyConfiguration.menuItems.map(item => ({
      ...item,
      path: destinationPath(item.path, state.path, `Tenant menu item "${item.id}"`),
    }))
    const configuredProfilePath = state.tenancyConfiguration.profilePath === undefined
      ? compiledTenancy?.profilePath
      : state.tenancyConfiguration.profilePath ?? undefined
    const configuredRegistrationPath = state.tenancyConfiguration.registrationPath === undefined
      ? compiledTenancy?.registrationPath
      : state.tenancyConfiguration.registrationPath ?? undefined
    const manifest = {
      assets: state.assets,
      auth: auth?.manifest ?? null,
      branding: state.branding,
      databaseNotifications: state.databaseNotifications,
      default: state.defaultPanel,
      globalSearch: state.globalSearch,
      globalSearchConfiguration: {
        debounce: state.globalSearchDebounce,
        enabled: state.globalSearch,
        fieldSuffix: state.globalSearchFieldSuffix,
        keybindingSuffix: state.globalSearchKeybindingSuffix,
        keybindings: state.globalSearchKeybindings,
        resourceOptIn: state.globalSearchResourceOptIn,
      },
      components: state.components,
      errorNotifications: state.errorNotifications,
      icons: state.icons,
      id: state.id,
      navigation,
      navigationEnabled: state.navigationEnabled,
      navigationGroups: state.navigationGroups,
      navigationMode: state.navigationMode,
      layout: state.layout,
      locales: normalizePanelLocaleConfiguration(state.locales.allowed, state.locales.fallback),
      path: state.path,
      routing: state.routing,
      runtime: state.runtime,
      sidebarCollapsible: state.sidebarCollapsible,
      slots: state.slots,
      theme: state.theme,
      tenancy: compiledTenancy === null ? null : {
        billing: state.tenancyConfiguration.billingProvider === null
          ? null
          : { path: destinationPath(state.tenancyConfiguration.billingRouteSlug, state.path, 'Panel tenant billing path') },
        enabled: true as const,
        menu: state.tenancyConfiguration.menu,
        menuItems: tenantMenuItems,
        ...(configuredProfilePath === undefined ? {} : {
          profile: { path: destinationPath(configuredProfilePath, state.path, 'Panel tenant profile path') },
        }),
        ...(configuredRegistrationPath === undefined ? {} : {
          registration: { path: destinationPath(configuredRegistrationPath, state.path, 'Panel tenant registration path') },
        }),
        requiresSubscription: state.tenancyConfiguration.requiresSubscription,
        routeDomain: state.tenancyConfiguration.routeDomain,
        routePrefix: state.tenancyConfiguration.routePrefix,
        searchableMenu: state.tenancyConfiguration.searchableMenu,
        switcher: state.tenancyConfiguration.switcher,
      },
      userMenu,
      userMenuEnabled: state.userMenuEnabled,
    }
    toJsonValue(manifest)
    const notificationInbox = state.databaseNotificationInbox ?? (state.databaseNotifications === null ? null : {
      authorize: () => true,
      resolve: (scope: Parameters<PanelDatabaseNotificationInboxOptions<TActor>['resolve']>[0]) => {
        const actor = scope.actor
        const id = typeof actor === 'object' && actor !== null ? Reflect.get(actor, 'id') : null
        const tenantId = typeof actor === 'object' && actor !== null ? Reflect.get(actor, 'tenantId') : null
        const recipientId = typeof id === 'string' || typeof id === 'number' ? id : ''
        const resolvedTenantId = typeof tenantId === 'string' || typeof tenantId === 'number' ? tenantId : null
        return {
          realtimeChannel: state.databaseNotifications?.realtime ? `panels.notifications.${state.guard}.${recipientId}` : null,
          recipient: { id: recipientId, type: state.actorRecipientType },
          tenantId: resolvedTenantId,
        }
      },
    } satisfies PanelDatabaseNotificationInboxOptions<TActor>)
    const notifications = notificationInbox === null ? {} : { notifications: { inbox: Object.freeze(notificationInbox) } }
    const authServer = auth === null ? {} : { auth: auth.server }
    const plugins = state.plugins.map(plugin => this.installPlugin(plugin, state.guard))
    const tenancy = compiledTenancy === null ? {} : {
      tenancy: state.tenancyConfiguration.billingProvider === null
        ? compiledTenancy
        : Object.freeze({ ...compiledTenancy, billing: state.tenancyConfiguration.billingProvider }),
    }
    return {
      discover: state.discover,
      guard: state.guard,
      kind: 'panel',
      manifest,
      server: {
        access: state.access,
        boot: state.boot,
        defaults: state.defaults,
        middleware: state.middleware,
        plugins,
        presentActor: async actor => projectActor(await state.actorPresenter(actor), state.actorHidden),
        registered: state.registered,
        routes: compilePanelRoutes(state.routes),
        ...authServer,
        ...notifications,
        ...tenancy,
      },
    }
  }

  private installPlugin(plugin: PanelPlugin<TActor>, guard: string): PreparedPanelPluginInstallation<TActor> {
    const installation = plugin.install(Object.freeze({ guard, id: this.readState().id }))
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

  private modelTenancyOptions<TTenantSource extends RuntimeTypeSource>(
    model: TTenantSource,
    options: PanelModelTenancyOptions<TActor, RuntimeTypeValue<TTenantSource>>,
  ): PanelTenancyOptions<TActor, RuntimeTypeValue<TTenantSource>, PanelTenantIdentifier, TTenantSource> {
    type TTenant = RuntimeTypeValue<TTenantSource>
    const columns = modelColumnNames(model)
    const idAttribute = options.idAttribute ?? (modelDefinitionValue(model, 'primaryKey') as Extract<keyof TTenant, string> | undefined) ?? 'id' as Extract<keyof TTenant, string>
    const routeKeyAttribute = options.routeKeyAttribute ?? (columns.includes('slug') ? 'slug' : columns.includes('key') ? 'key' : idAttribute) as Extract<keyof TTenant, string>
    const nameAttribute = options.nameAttribute ?? (columns.includes('name') ? 'name' : routeKeyAttribute) as Extract<keyof TTenant, string>
    const relationship = String(options.relationship ?? modelTableName(model))
    const activeTenantAttribute = String(options.activeTenantAttribute ?? 'tenantId')
    const memberships = async (actor: TActor): Promise<readonly TTenant[]> => {
      const values = await actorTenantMemberships<TActor, TTenant>(actor, relationship, this.#actorSource)
      if (!options.canAccess) return values
      const access = await Promise.all(values.map(tenant => options.canAccess!(tenant, actor)))
      return Object.freeze(values.filter((_tenant, index) => access[index] === true))
    }
    const persistedActor = async (actor: TActor) => {
      if (typeof actor === 'object' && actor !== null && 'update' in actor && typeof actor.update === 'function') return actor
      const actorSource = this.#actorSource
      if (!actorSource || !('find' in actorSource) || typeof actorSource.find !== 'function') return null
      const actorKey = String(modelDefinitionValue(actorSource, 'primaryKey') ?? 'id')
      const identifier = modelAttribute(actor, actorKey)
      if (typeof identifier !== 'number' && typeof identifier !== 'string') return null
      const record = await actorSource.find(identifier)
      return typeof record === 'object' && record !== null && 'update' in record && typeof record.update === 'function' ? record : null
    }
    const persistence = options.persistence ?? {
      clear: async (scope) => {
        const actor = await persistedActor(scope.actor)
        if (actor) await actor.update({ [activeTenantAttribute]: null })
      },
      load: async (scope) => {
        if (typeof scope.actor !== 'object' || scope.actor === null) return null
        const value = modelAttribute(scope.actor, activeTenantAttribute)
        return value === null || value === undefined ? null : tenantIdentifier(value, 'Active tenant identifiers')
      },
      save: async (scope, tenantId) => {
        const actor = await persistedActor(scope.actor)
        if (!actor) {
          throw new Error('Model-backed panel tenancy requires an authenticated actor that can persist its active tenant')
        }
        await actor.update({ [activeTenantAttribute]: tenantId })
      },
    }
    return {
      authorize: async (tenant, scope) => (await memberships(scope.actor)).some(candidate => tenantIdentifier(modelAttribute(candidate, String(idAttribute)), 'Tenant identifiers') === tenantIdentifier(modelAttribute(tenant, String(idAttribute)), 'Tenant identifiers')),
      findMembershipById: async (tenantId, scope) => (await memberships(scope.actor)).find(tenant => tenantIdentifier(modelAttribute(tenant, String(idAttribute)), 'Tenant identifiers') === tenantId) ?? null,
      findMembershipByRouteKey: async (routeKey, scope) => (await memberships(scope.actor)).find(tenant => String(modelAttribute(tenant, String(routeKeyAttribute))) === routeKey) ?? null,
      identify: tenant => tenantIdentifier(modelAttribute(tenant, String(idAttribute)), 'Tenant identifiers'),
      membershipPageSize: options.membershipPageSize,
      memberships: async (request, scope) => {
        const values = await memberships(scope.actor)
        const search = request.search.trim().toLocaleLowerCase()
        const filtered = search ? values.filter(tenant => String(modelAttribute(tenant, String(nameAttribute))).toLocaleLowerCase().includes(search)) : values
        const offset = request.cursor === null ? 0 : Number(request.cursor)
        if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Tenant membership cursors must be non-negative integers')
        const page = filtered.slice(offset, offset + request.limit)
        return { nextCursor: offset + page.length < filtered.length ? String(offset + page.length) : null, tenants: page }
      },
      model,
      persistence,
      present: tenant => ({
        ...(options.avatarAttribute ? { avatarUrl: String(modelAttribute(tenant, String(options.avatarAttribute)) ?? '') || null } : {}),
        ...(options.descriptionAttribute ? { description: String(modelAttribute(tenant, String(options.descriptionAttribute)) ?? '') || null } : {}),
        label: String(modelAttribute(tenant, String(nameAttribute)) ?? modelAttribute(tenant, String(routeKeyAttribute)) ?? ''),
      }),
      routeKey: tenant => String(modelAttribute(tenant, String(routeKeyAttribute)) ?? ''),
    }
  }

  private defaultProfileConfiguration(): NonNullable<PanelState<TActor>['authFeatures']['profile']> {
    const fields = modelColumnNames(this.#actorSource ?? { prototype: {} }).filter(field => field === 'name' || field === 'email')
    if (fields.length === 0) return true
    const schema = defineSchema('panel-profile').compile()
    return {
      fields,
      schema,
      values: context => Object.freeze(Object.fromEntries(fields.map(field => [field, modelAttribute(context.actor, field)]))),
      update: async (context, input) => {
        const identifier = modelAttribute(context.actor, String(this.#actorSource ? modelDefinitionValue(this.#actorSource, 'primaryKey') ?? 'id' : 'id'))
        const actor = typeof context.actor === 'object' && context.actor !== null && 'update' in context.actor && typeof context.actor.update === 'function'
          ? context.actor
          : this.#actorSource && (typeof identifier === 'string' || typeof identifier === 'number') && 'find' in this.#actorSource && typeof this.#actorSource.find === 'function'
            ? await this.#actorSource.find(identifier)
            : null
        if (typeof actor !== 'object' || actor === null || !('update' in actor) || typeof actor.update !== 'function') {
          throw new Error('Convention-based panel profiles require an updatable authenticated actor model')
        }
        await Reflect.apply(actor.update, actor, [input])
      },
    }
  }

  private writeAuthFeature<TKey extends keyof PanelState<TActor>['authFeatures']>(
    key: TKey,
    value: PanelState<TActor>['authFeatures'][TKey],
  ): this {
    return this.writeState('authFeatures', { ...this.readState().authFeatures, [key]: value })
  }

  private writeAuthRoute<TKey extends keyof PanelState<TActor>['authRoutes']>(key: TKey, value: string): this {
    const route = value.trim().replace(/^\/+|\/+$/gu, '')
    if (!route || !/^[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)*$/iu.test(route)) {
      throw new Error('Panel authentication route slugs require static route segments')
    }
    return this.writeState('authRoutes', { ...this.readState().authRoutes, [key]: route })
  }

  private authFeaturesWithRoutes(state: Readonly<PanelState<TActor>>): PanelState<TActor>['authFeatures'] {
    const routes = state.authRoutes
    const join = (prefix: string | null, slug: string): string => prefix ? `${prefix}/${slug}` : slug
    const login = state.authFeatures.login
    const registration = state.authFeatures.registration
    const passwordReset = state.authFeatures.passwordReset
    const emailVerification = state.authFeatures.emailVerification
    const emailChangeVerification = state.authFeatures.emailChangeVerification
    return {
      ...state.authFeatures,
      ...(login && routes.loginSlug ? { login: { ...(login === true ? {} : login), path: routes.loginSlug } } : {}),
      ...(registration && routes.registrationSlug ? { registration: { ...(registration === true ? {} : registration), path: routes.registrationSlug } } : {}),
      ...(passwordReset ? {
        passwordReset: {
          ...passwordReset,
          ...(routes.passwordResetPrefix || routes.passwordResetRequestSlug ? {
            requestPath: join(routes.passwordResetPrefix, routes.passwordResetRequestSlug ?? 'request'),
          } : {}),
          ...(routes.passwordResetPrefix || routes.passwordResetSlug ? {
            resetPath: join(routes.passwordResetPrefix, routes.passwordResetSlug ?? 'reset'),
          } : {}),
        },
      } : {}),
      ...(emailVerification ? {
        emailVerification: {
          ...(emailVerification === true ? {} : emailVerification),
          ...(routes.emailVerificationPrefix || routes.emailVerificationPromptSlug ? {
            path: join(routes.emailVerificationPrefix, routes.emailVerificationPromptSlug ?? 'prompt'),
          } : {}),
          ...(routes.emailVerificationPrefix || routes.emailVerificationSlug ? {
            verificationPath: join(routes.emailVerificationPrefix, routes.emailVerificationSlug ?? 'verify'),
          } : {}),
        },
      } : {}),
      ...(emailChangeVerification && (routes.emailChangeVerificationPrefix || routes.emailChangeVerificationSlug) ? {
        emailChangeVerification: {
          ...(emailChangeVerification === true ? {} : emailChangeVerification),
          path: join(routes.emailChangeVerificationPrefix, routes.emailChangeVerificationSlug ?? 'verify'),
        },
      } : {}),
    }
  }

  private writeRuntime<TKey extends keyof PanelState<TActor>['runtime']>(
    key: TKey,
    value: PanelState<TActor>['runtime'][TKey],
  ): this {
    return this.writeState('runtime', { ...this.readState().runtime, [key]: value })
  }

  private writeRoute(scope: PanelRouteScope, registrar: PanelRouteRegistrar): this {
    if (typeof registrar !== 'function') throw new Error('Panel route registration requires a callback')
    return this.writeState('routes', { ...this.readState().routes, [scope]: [...this.readState().routes[scope], registrar] })
  }

  private writeMiddleware(
    key: 'authenticated' | 'panel' | 'tenant',
    values: readonly PanelMiddleware<TActor>[],
  ): this {
    return this.writeState('middleware', {
      ...this.readState().middleware,
      [key]: [...this.readState().middleware[key], ...values],
    })
  }

  private writeMiddlewareInput(
    key: 'authenticated' | 'panel' | 'tenant',
    values: readonly PanelMiddleware<TActor>[],
    isPersistent: boolean,
  ): this {
    const state = this.readState().middleware
    if (!isPersistent) return this.writeMiddleware(key, values)
    return this.writeState('middleware', {
      ...state,
      [key]: [...state[key], ...values],
      persistent: { ...state.persistent, [key]: [...state.persistent[key], ...values] },
    })
  }

  private writeTenancyConfiguration<TKey extends keyof PanelState<TActor>['tenancyConfiguration']>(
    key: TKey,
    value: PanelState<TActor>['tenancyConfiguration'][TKey],
  ): this {
    return this.writeState('tenancyConfiguration', {
      ...this.readState().tenancyConfiguration,
      [key]: value,
    })
  }

  private staticRoute(value: string, label: string): string {
    const route = value.trim().replace(/^\/+|\/+$/gu, '')
    if (!route || !/^[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)*$/iu.test(route)) {
      throw new Error(`${label} require static route segments`)
    }
    return route
  }

  private routeSegment(value: string, label: string): string {
    const segment = this.staticRoute(value, label)
    if (segment.includes('/')) throw new Error(`${label} require a single route segment`)
    return segment
  }

  private componentReference(value: string, label: string): string {
    const reference = value.trim()
    if (!reference || reference.length > 214 || hasControlCharacter(reference) || !/^[a-z0-9@][a-z0-9@._:/-]*$/iu.test(reference)) {
      throw new Error(`${label} require a safe registered reference`)
    }
    return reference
  }

  private assertStatusCode(value: number): void {
    if (!Number.isInteger(value) || value < 400 || value > 599) throw new Error('Panel error notification status codes must be between 400 and 599')
  }

  private cssLength(value: string, label: string): string {
    const length = value.trim()
    if (!/^\d+(?:\.\d+)?(?:px|rem|em|vw|%)$/u.test(length)) throw new Error(`${label} require a CSS length`)
    return length
  }

  private hostname(value: string, label: string): string {
    const hostname = value.trim().toLowerCase()
    if (!/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?$/u.test(hostname)) {
      throw new Error(`${label} require valid hostnames`)
    }
    return hostname
  }

  private writeDiscovery(key: keyof DiscoveryDirectories, path: string): this {
    const normalized = path.trim().replace(/^\.\//u, '')
    if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('Discovery directories must be panel-relative')
    return this.writeState('discover', { ...this.readState().discover, [key]: normalized })
  }

  private register<TKind extends ExplicitPanelKind>(kind: TKind, values: readonly ExplicitPanelDefinition<TKind>[]): this {
    const registered = compileRegistered(kind, values)
    const current = this.readState().registered
    const keys = new Set(current.map(item => `${item.definition.kind}:${item.definition.id}`))
    for (const registration of registered) {
      const key = `${registration.definition.kind}:${registration.definition.id}`
      if (keys.has(key)) {
        throw new Error(`Panel ${kind} "${registration.definition.id}" is already registered`)
      }
      keys.add(key)
    }
    return this.writeState('registered', [...current, ...registered])
  }
}

export type PanelActorSource<TActor extends object = object> =
  | { readonly prototype: TActor }
  | { create(...parameters: never[]): TActor | Promise<TActor> }

export function definePanel<TActorSource extends RecordTypeSource>(id: string, actor: TActorSource): PanelBuilder<RuntimeTypeValue<TActorSource>>
export function definePanel<TActorSource extends RecordTypeSource>(actor: TActorSource): PanelBuilder<RuntimeTypeValue<TActorSource>>
export function definePanel(id: string): PanelBuilder<unknown>
export function definePanel(): PanelBuilder<unknown>
export function definePanel(idOrActor: string | RecordTypeSource = 'panel', actor?: RecordTypeSource): unknown {
  return typeof idOrActor === 'string'
    ? new PanelBuilder(idOrActor, actor)
    : new PanelBuilder('panel', idOrActor)
}
