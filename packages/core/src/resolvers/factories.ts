import type { JsonValue } from '../protocol/json'
import type { RecordTypeSource, RecordTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import { readFieldPath, type FieldPath, type FieldPathValue } from './paths'
import type {
  ClientExpression,
  ClientExpressionNode,
  ExplicitServerResolver,
  LiteralResolver,
  NamedClientResolver,
  NullResolver,
  RawServerCallback,
  ResolverContext,
  ResolverContextInput,
  ResolverDomain,
  ServerResolverRequest,
  ServerValueResolver,
} from './types'

const RESOLVER_NAME_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/

function assertResolverName(name: string, label: string): void {
  if (!RESOLVER_NAME_PATTERN.test(name)) throw new Error(`[Holo Panels] Invalid ${label} "${name}".`)
}

export function literal<TValue extends JsonValue>(value: TValue): LiteralResolver<TValue> {
  return Object.freeze({ kind: 'literal', value })
}

export function nullResolver(): NullResolver {
  return Object.freeze({ kind: 'null', value: null })
}

export function clientExpression<TValueSource extends RuntimeTypeSource>(
  _value: TValueSource,
  expression: ClientExpressionNode,
): ClientExpression<RuntimeTypeValue<TValueSource> & JsonValue> {
  return Object.freeze({ kind: 'client-expression', expression })
}

export function clientResolver<TValueSource extends RuntimeTypeSource, TInput extends JsonValue = JsonValue>(
  _value: TValueSource,
  name: string,
  input?: TInput,
): NamedClientResolver<RuntimeTypeValue<TValueSource> & JsonValue, TInput> {
  assertResolverName(name, 'client resolver name')
  return Object.freeze({
    kind: 'named-client-resolver',
    name,
    ...(typeof input === 'undefined' ? {} : { input }),
  })
}

export function serverResolver<TValue extends JsonValue, TContextSource extends RuntimeTypeSource>(
  id: string,
  context: TContextSource,
  resolve: RawServerCallback<TValue, RuntimeTypeValue<TContextSource>>,
  dependencies?: readonly string[],
): ExplicitServerResolver<TValue, RuntimeTypeValue<TContextSource>>
export function serverResolver<TValue extends JsonValue>(
  id: string,
  resolve: RawServerCallback<TValue, unknown>,
  dependencies?: readonly string[],
): ExplicitServerResolver<TValue, unknown>
export function serverResolver<TValue extends JsonValue, TContext>(
  id: string,
  contextOrResolve: RuntimeTypeSource | RawServerCallback<TValue, TContext>,
  resolveOrDependencies: RawServerCallback<TValue, TContext> | readonly string[] = [],
  sourceDependencies: readonly string[] = [],
): ExplicitServerResolver<TValue, TContext> {
  assertResolverName(id, 'server resolver ID')
  const sourced = typeof contextOrResolve !== 'function'
    || contextOrResolve === Boolean
    || contextOrResolve === Number
    || contextOrResolve === String
    || 'prototype' in contextOrResolve && contextOrResolve.prototype !== undefined
      && typeof resolveOrDependencies === 'function'
  const resolve = (sourced ? resolveOrDependencies : contextOrResolve) as RawServerCallback<TValue, TContext>
  const dependencies = sourced
    ? sourceDependencies
    : Array.isArray(resolveOrDependencies) ? resolveOrDependencies : []
  return Object.freeze({
    kind: 'server-resolver',
    id,
    dependencies: Object.freeze([...new Set(dependencies)].sort()),
    resolve,
  })
}

class FormResolverContextTypeSource<TValues extends object> {
  declare readonly actor: undefined
  readonly domain = 'form' as const
  declare readonly locale: string
  declare readonly record: undefined
  declare readonly services: undefined
  declare readonly tenant: undefined
  declare readonly values: TValues

  get<TPath extends FieldPath<TValues>>(_path: TPath): FieldPathValue<TValues, TPath> {
    throw new Error('Resolver context type sources cannot be instantiated')
  }
}

export function formResolverContextFor<TValuesSource extends RecordTypeSource>(
  _values: TValuesSource,
): { readonly prototype: ResolverContext<'form', RecordTypeValue<TValuesSource>> } {
  return FormResolverContextTypeSource<RecordTypeValue<TValuesSource>>
}

function resolverParts<TValue extends JsonValue, TContext>(resolver: ServerValueResolver<TValue, TContext>): {
  readonly id?: string
  readonly dependencies: readonly string[]
  readonly resolve: RawServerCallback<TValue, TContext>
} {
  if (typeof resolver === 'function') return { dependencies: [], resolve: resolver }
  return { id: resolver.id, dependencies: resolver.dependencies, resolve: resolver.resolve }
}

export function createServerResolverRequest<
  TValue extends JsonValue,
  TDomain extends ResolverDomain,
  TValues extends object,
  TRecord,
  TActor,
  TTenant,
  TServices,
>(
  target: string,
  resolver: ServerValueResolver<TValue, ResolverContext<TDomain, TValues, TRecord, TActor, TTenant, TServices>>,
  contextInput: ResolverContextInput<TDomain, TValues, TRecord, TActor, TTenant, TServices>,
): ServerResolverRequest {
  if (!target.trim()) throw new Error('[Holo Panels] Resolver targets cannot be empty.')
  const parts = resolverParts(resolver)
  return Object.freeze({
    target,
    ...(parts.id ? { resolverId: parts.id } : {}),
    explicitDependencies: parts.dependencies,
    async run(observe: (path: string) => void): Promise<JsonValue> {
      const context: ResolverContext<TDomain, TValues, TRecord, TActor, TTenant, TServices> = {
        ...contextInput,
        get(path) {
          observe(path)
          return readFieldPath(contextInput.values, path)
        },
      }
      return parts.resolve(context)
    },
  })
}
