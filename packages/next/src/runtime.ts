import { createNextRequestContext, runWithNextRequest } from '@holo-js/adapter-next/runtime'
import {
  PROTOCOL_VERSION,
  decodeResponseEnvelope,
  type CompiledPageDefinition,
  type CompiledPanelDefinition,
  type JsonObject,
  type Effect,
  type PanelAuthenticatedScope,
} from '@holo-js/panels-react'
import { PanelRuntime, preparePageRoutes, resolvePageData } from '@holo-js/panels-react/server'
import type { NextPanelPagePayload, NextPanelsRuntime } from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
let installedRuntime: NextPanelsRuntime | null = null

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} must be a stable identifier`)
}

function compiled(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && 'compile' in value && typeof value.compile === 'function') return value.compile()
  return value
}

function isPanel(value: unknown): value is CompiledPanelDefinition<object> {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'kind') === 'panel'
}

function isPage(value: unknown): value is CompiledPageDefinition<JsonObject, object, unknown, unknown> {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'kind') === 'page'
}

function registryKeys(runtime: NextPanelsRuntime, panelId: string, kind: 'page' | 'panel'): readonly string[] {
  const prefix = `${panelId}:${kind}:`
  return Object.keys(runtime.registry).filter(key => key.startsWith(prefix) && IDENTIFIER.test(key.slice(prefix.length))).sort()
}

async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'page'): Promise<readonly CompiledPageDefinition<JsonObject, object, unknown, unknown>[]>
async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'panel'): Promise<readonly CompiledPanelDefinition<object>[]>
async function definitions(runtime: NextPanelsRuntime, panelId: string, kind: 'page' | 'panel'): Promise<readonly unknown[]> {
  const values = await Promise.all(registryKeys(runtime, panelId, kind).map(key => runtime.registry[key]!()))
  const compiledValues = values.map(value => compiled(value))
  return kind === 'panel' ? compiledValues.filter(isPanel) : compiledValues.filter(isPage)
}

function pageParameters(pattern: string, path: string): Readonly<Record<string, string>> | null {
  const expected = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const parameters: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    const expectedSegment = expected[index]!
    const actualSegment = actual[index]!
    if (expectedSegment.startsWith(':')) parameters[expectedSegment.slice(1)] = decodeURIComponent(actualSegment)
    else if (expectedSegment !== actualSegment) return null
  }
  return Object.freeze(parameters)
}

function safeSegments(segments: readonly string[]): readonly string[] {
  return segments.map(segment => {
    if (!segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\') || /%(?:2e|2f|5c)/iu.test(segment)) {
      throw new Error('Panel paths contain an unsafe segment')
    }
    return encodeURIComponent(decodeURIComponent(segment))
  })
}

async function auth(runtime: NextPanelsRuntime) {
  return typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
}

function sessionEffectKey(panelId: string): string {
  return `panels.effects.${panelId}`
}

function decodedSessionEffects(value: unknown): readonly Effect[] {
  if (!Array.isArray(value)) return Object.freeze([])
  try {
    return Object.freeze(decodeResponseEnvelope({
      data: null,
      effects: value,
      id: 'session-effects',
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
    }, 'session-effects').effects.filter(effect => effect.kind === 'toast'))
  } catch {
    return Object.freeze([])
  }
}

async function takeSessionEffects(
  guard: { readonly take?: <TValue = unknown>(key: string) => Promise<TValue | undefined> },
  panelId: string,
): Promise<readonly Effect[]> {
  if (!guard.take) return Object.freeze([])
  try {
    return decodedSessionEffects(await guard.take(sessionEffectKey(panelId)))
  } catch {
    return Object.freeze([])
  }
}

export function registerNextPanelsRuntime(runtime: NextPanelsRuntime): () => void {
  const previous = installedRuntime
  installedRuntime = runtime
  return () => {
    if (installedRuntime === runtime) installedRuntime = previous
  }
}

export function requireNextPanelsRuntime(runtime?: NextPanelsRuntime): NextPanelsRuntime {
  const resolved = runtime ?? installedRuntime
  if (!resolved) throw new Error('[Holo Panels] Next runtime is unavailable. Run `holo prepare` and register its generated panels server registry.')
  return resolved
}

export async function resolveNextPanelPath(panelId: string, runtimeInput?: NextPanelsRuntime): Promise<string> {
  assertIdentifier(panelId, 'Panel IDs')
  const runtime = requireNextPanelsRuntime(runtimeInput)
  const panels = await definitions(runtime, panelId, 'panel')
  const panel = panels.find(definition => definition.manifest.id === panelId)
  if (!panel) throw new NextPanelPageNotFoundError(`panel:${panelId}`)
  return panel.manifest.path
}

export async function resolveNextPanelPage(
  panelId: string,
  panelsPath: readonly string[],
  request: Request,
  runtimeInput?: NextPanelsRuntime,
): Promise<NextPanelPagePayload> {
  assertIdentifier(panelId, 'Panel IDs')
  const runtime = requireNextPanelsRuntime(runtimeInput)
  const panels = await definitions(runtime, panelId, 'panel')
  const panel = panels.find(definition => definition.manifest.id === panelId)
  if (!panel) throw new Error(`[Holo Panels] Generated registry does not contain panel "${panelId}".`)
  const path = `${panel.manifest.path === '/' ? '' : panel.manifest.path}/${safeSegments(panelsPath).join('/')}`.replace(/\/$/u, '') || '/'
  const pages = preparePageRoutes(await definitions(runtime, panelId, 'page'))
  const match = pages.map(definition => ({ definition, parameters: pageParameters(definition.manifest.path, path) }))
    .find(candidate => candidate.parameters !== null)
  if (!match?.parameters) throw new NextPanelPageNotFoundError(path)
  const nextContext = createNextRequestContext(request)
  return runWithNextRequest(nextContext, async () => {
    const resolvedAuth = await auth(runtime)
    const panelRuntime = new PanelRuntime(resolvedAuth, [panel])
    const bootstrap = (await panelRuntime.bootstrap([panelId], request.signal))[0]!
    const page = await panelRuntime.execute(panelId, 'page-data', request.signal, async (scope: PanelAuthenticatedScope<object>) => resolvePageData(match.definition, {
      actor: scope.actor,
      locale: await runtime.resolveLocale?.(request) ?? 'en',
      panelId,
      parameters: match.parameters!,
      services: await runtime.resolveServices?.(request),
      signal: request.signal,
      tenant: await runtime.resolveTenant?.(request),
    }))
    const effects = await takeSessionEffects(resolvedAuth.guard(panel.guard), panelId)
    return Object.freeze({ bootstrap: bootstrap as unknown as NextPanelPagePayload['bootstrap'], effects, page, path })
  })
}

export class NextPanelPageNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Panel page "${path}" was not found`)
    this.name = 'NextPanelPageNotFoundError'
  }
}

export const nextPanelsRuntimeInternals = {
  definitions,
  pageParameters,
  registryKeys,
  safeSegments,
}
