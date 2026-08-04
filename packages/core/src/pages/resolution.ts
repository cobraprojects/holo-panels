import type { JsonObject } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import { toSchemaManifest } from '../schemas/manifest'
import type { CompiledPageDefinition, PageContext, PageManifest, PageResolvable, ResolvedPageData } from './contracts'

export class PageAccessError extends Error {
  constructor() {
    super('The current actor cannot access this page')
    this.name = 'PageAccessError'
  }
}

async function resolve<TContext, TValue>(value: PageResolvable<TContext, TValue> | undefined, context: TContext, fallback: TValue): Promise<TValue> {
  if (value === undefined) return fallback
  return typeof value === 'function'
    ? (value as (scope: TContext) => TValue | Promise<TValue>)(context)
    : value
}

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
}

function assertDestination(path: string, label: string): void {
  if (path !== path.trim() || !path.startsWith('/') || path.includes('\\') || hasControlCharacter(path) || path.includes('?') || path.includes('#') || path.includes('//')) {
    throw new Error(`${label} must be a normalized absolute route`)
  }
  if (path.split('/').some(segment => segment === '.' || segment === '..' || /%(?:2e|2f|5c)/iu.test(segment))) {
    throw new Error(`${label} must be a safe route`)
  }
}

function routePattern(path: string): string {
  return path
    .split('/')
    .map(segment => segment.startsWith(':') ? ':' : segment)
    .join('/')
}

function compareRoutes(left: PageManifest, right: PageManifest): number {
  const leftSegments = left.path.split('/').slice(1)
  const rightSegments = right.path.split('/').slice(1)
  const length = Math.max(leftSegments.length, rightSegments.length)
  for (let index = 0; index < length; index += 1) {
    const leftSegment = leftSegments[index]
    const rightSegment = rightSegments[index]
    if (leftSegment === undefined) return -1
    if (rightSegment === undefined) return 1
    const leftDynamic = leftSegment.startsWith(':')
    const rightDynamic = rightSegment.startsWith(':')
    if (leftDynamic !== rightDynamic) return leftDynamic ? 1 : -1
    if (!leftDynamic) {
      const comparison = leftSegment.localeCompare(rightSegment)
      if (comparison !== 0) return comparison
    }
  }
  return left.id.localeCompare(right.id)
}

export function preparePageRoutes<TPage extends { readonly manifest: PageManifest }>(pages: readonly TPage[]): readonly TPage[] {
  const patterns = new Map<string, string>()
  for (const page of pages) {
    const pattern = routePattern(page.manifest.path)
    const existing = patterns.get(pattern)
    if (existing) throw new Error(`Page route "${page.manifest.path}" conflicts with "${existing}"`)
    patterns.set(pattern, page.manifest.path)
  }
  return Object.freeze([...pages].sort((left, right) => compareRoutes(left.manifest, right.manifest)))
}

export async function resolvePageData<TData extends JsonObject, TActor, TTenant, TServices>(
  definition: CompiledPageDefinition<TData, TActor, TTenant, TServices>,
  context: PageContext<TActor, TTenant, TServices>,
): Promise<Readonly<ResolvedPageData<TData>>> {
  if (!await definition.server.authorize(context)) throw new PageAccessError()
  const [data, title, heading, subheading, breadcrumbs, schema] = await Promise.all([
    definition.server.load?.(context) ?? Promise.resolve({} as TData),
    resolve(definition.server.title, context, definition.manifest.id),
    resolve(definition.server.heading, context, null),
    resolve(definition.server.subheading, context, null),
    resolve(definition.server.breadcrumbs, context, []),
    resolve(definition.server.schema, context, null),
  ])
  for (const [index, breadcrumb] of breadcrumbs.entries()) {
    if (!breadcrumb.label.trim()) throw new Error(`Page breadcrumb ${index} labels cannot be empty`)
    assertDestination(breadcrumb.path, `Page breadcrumb ${index}`)
  }
  const resolved = toJsonValue({ breadcrumbs, data, heading, manifest: definition.manifest, schema: schema ? await toSchemaManifest(schema, context) : null, subheading, title })
  if (resolved === null || Array.isArray(resolved) || typeof resolved !== 'object') throw new TypeError('Resolved page data must be JSON-safe')
  return Object.freeze(resolved as unknown as ResolvedPageData<TData>)
}
