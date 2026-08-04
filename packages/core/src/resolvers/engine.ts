import { toJsonValue } from '../protocol/serialization'
import type {
  ResolverComponentError,
  ServerResolverBatchOptions,
  ServerResolverBatchResult,
  ServerResolverPatch,
  ServerResolverRequest,
} from './types'

const MAXIMUM_BATCH_REQUESTS = 100

export class ResolverDependencyCycleError extends Error {
  readonly dependencyPath: readonly string[]

  constructor(dependencyPath: readonly string[]) {
    super(`[Holo Panels] Resolver dependency cycle: ${dependencyPath.join(' -> ')}.`)
    this.name = 'ResolverDependencyCycleError'
    this.dependencyPath = Object.freeze([...dependencyPath])
  }
}

function cyclePath(requests: readonly Pick<ServerResolverRequest, 'explicitDependencies' | 'target'>[]): readonly string[] | undefined {
  const targets = new Set(requests.map(request => request.target))
  const dependencies = new Map(requests.map(request => [
    request.target,
    request.explicitDependencies.filter(dependency => targets.has(dependency)),
  ]))
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []

  function visit(target: string): readonly string[] | undefined {
    if (active.has(target)) {
      const cycleStart = path.indexOf(target)
      return [...path.slice(cycleStart), target]
    }
    if (visited.has(target)) return undefined
    active.add(target)
    path.push(target)
    for (const dependency of dependencies.get(target) ?? []) {
      const cycle = visit(dependency)
      if (cycle) return cycle
    }
    path.pop()
    active.delete(target)
    visited.add(target)
    return undefined
  }

  for (const target of targets) {
    const cycle = visit(target)
    if (cycle) return cycle
  }
  return undefined
}

function safeError(
  target: string,
  resolverId: string | undefined,
  error: unknown,
  environment: 'development' | 'production',
): ResolverComponentError {
  const developmentMessage = error instanceof Error ? error.message : 'Unknown resolver failure.'
  return Object.freeze({
    code: 'resolver_failed',
    message: environment === 'production' ? 'Unable to resolve this component.' : developmentMessage,
    ...(resolverId ? { resolverId } : {}),
    target,
  })
}

export class ServerResolverBatcher {
  readonly #latestRequests = new Map<string, { readonly token: symbol, readonly version: number }>()

  async resolve(options: ServerResolverBatchOptions): Promise<ServerResolverBatchResult> {
    if (!Number.isSafeInteger(options.version) || options.version < 0) {
      throw new Error('[Holo Panels] Resolver batch versions must be non-negative safe integers.')
    }
    if (!options.scope.trim()) throw new Error('[Holo Panels] Resolver batch scopes cannot be empty.')
    if (options.requests.length > MAXIMUM_BATCH_REQUESTS) {
      throw new Error(`[Holo Panels] Resolver batches cannot exceed ${MAXIMUM_BATCH_REQUESTS} requests.`)
    }
    const existingRequest = this.#latestRequests.get(options.scope)
    if (existingRequest && options.version < existingRequest.version) {
      return Object.freeze({ scope: options.scope, version: options.version, stale: true, patches: Object.freeze([]) })
    }
    const duplicateTargets = options.requests
      .map(request => request.target)
      .filter((target, index, targets) => targets.indexOf(target) !== index)
    if (duplicateTargets.length > 0) {
      throw new Error(`[Holo Panels] Duplicate resolver target "${duplicateTargets[0]}".`)
    }
    const explicitCycle = cyclePath(options.requests)
    if (explicitCycle) throw new ResolverDependencyCycleError(explicitCycle)

    const token = Symbol(options.scope)
    this.#latestRequests.set(options.scope, { token, version: options.version })
    const environment = options.environment ?? 'production'
    const patches = await Promise.all(options.requests.map(async (request): Promise<ServerResolverPatch> => {
      const observed = new Set<string>()
      try {
        const value = toJsonValue(await request.run(path => observed.add(path)))
        return Object.freeze({
          target: request.target,
          dependencies: Object.freeze([...new Set([...request.explicitDependencies, ...observed])].sort()),
          value,
        })
      } catch (error) {
        return Object.freeze({
          target: request.target,
          dependencies: Object.freeze([...new Set([...request.explicitDependencies, ...observed])].sort()),
          error: safeError(request.target, request.resolverId, error, environment),
        })
      }
    }))

    if (this.#latestRequests.get(options.scope)?.token !== token) {
      return Object.freeze({ scope: options.scope, version: options.version, stale: true, patches: Object.freeze([]) })
    }
    const observedCycle = cyclePath(patches.map(patch => ({
      target: patch.target,
      explicitDependencies: patch.dependencies,
    })))
    if (observedCycle) throw new ResolverDependencyCycleError(observedCycle)
    return Object.freeze({
      scope: options.scope,
      version: options.version,
      stale: false,
      patches: Object.freeze(patches),
    })
  }
}
