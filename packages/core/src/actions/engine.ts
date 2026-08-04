import type { JsonObject } from '../protocol/json'
import type { PanelNotificationPresentation } from '../notifications/contracts'
import { validatedToastPresentation, type Effect, type RichToastEffect } from '../protocol/effects'
import type {
  ActionContext,
  ActionDefinition,
  ActionEngineOptions,
  ActionExecutionRequest,
  ActionExecutionResult,
  ActionItemResult,
} from './contracts'

const MAX_BULK_RECORDS = 500
const MAX_CACHED_EXECUTIONS = 1000
const MAX_RESPONSE_EFFECTS = 20
const EXECUTION_TTL_MS = 5 * 60 * 1000

interface CachedExecution<TRecordId extends number | string> {
  readonly actionId: string
  readonly actor: unknown
  readonly expiresAt: number
  readonly fingerprint: string
  readonly idempotencyKey: string
  readonly promise: Promise<ActionExecutionResult<TRecordId, unknown>>
  settled: boolean
  readonly tenant: unknown
}

interface RecordExecution<TRecord, TRecordId extends number | string, TResult, TActor, TTenant, TServices> {
  readonly context: ActionContext<TRecord, TActor, TTenant, TServices>
  readonly item: ActionItemResult<TRecordId, TResult>
}

interface RateLimitWindow {
  count: number
  expiresAt: number
}

function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Action requests require finite JSON numbers')
    return JSON.stringify(Object.is(value, -0) ? 0 : value)
  }
  if (typeof value !== 'object') throw new TypeError('Action requests must contain only JSON values')
  if (ancestors.has(value)) throw new TypeError('Action requests cannot contain circular values')
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Action requests cannot contain class instances')
  }
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item, ancestors)).join(',')}]`
    const entries = Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key], ancestors)}`)
    return `{${entries.join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

export class ActionExecutionError extends Error {
  constructor(
    readonly code: 'denied' | 'failed' | 'idempotency-conflict' | 'rate-limited' | 'record-not-found' | 'stale',
    message: string,
    readonly effects: readonly Effect[] = Object.freeze([]),
  ) {
    super(message)
    this.name = 'ActionExecutionError'
  }
}

export class ActionEngine<TRecord, TRecordId extends number | string, TActor, TTenant, TServices> {
  readonly #executions: CachedExecution<TRecordId>[] = []
  readonly #rateLimits = new Map<string, RateLimitWindow>()

  constructor(readonly options: ActionEngineOptions<TRecord, TRecordId, TActor, TTenant>) {}

  execute<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    request: ActionExecutionRequest<TInput, TRecordId>,
    scope: { readonly actor: TActor, readonly services: TServices, readonly signal: AbortSignal, readonly tenant: TTenant },
  ): Promise<ActionExecutionResult<TRecordId, TResult>> {
    const now = Date.now()
    this.pruneExecutions(now)
    const fingerprint = canonicalJson({
      expectedVersions: request.expectedVersions ?? null,
      input: request.input,
      mount: request.mount,
      recordIds: request.recordIds ?? [],
    })
    const cached = this.#executions.find(entry => (
      entry.actionId === definition.id
      && Object.is(entry.actor, scope.actor)
      && entry.idempotencyKey === request.idempotencyKey
      && Object.is(entry.tenant, scope.tenant)
    ))
    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        return Promise.reject(new ActionExecutionError('idempotency-conflict', 'The idempotency key was already used for a different action request'))
      }
      if (cached.settled) {
        return cached.promise.then(result => Object.freeze({ ...result, effects: Object.freeze([]) })) as Promise<ActionExecutionResult<TRecordId, TResult>>
      }
      return cached.promise as Promise<ActionExecutionResult<TRecordId, TResult>>
    }
    const execution = this.run(definition, request, scope)
    const cachedExecution: CachedExecution<TRecordId> = {
      actionId: definition.id,
      actor: scope.actor,
      expiresAt: now + EXECUTION_TTL_MS,
      fingerprint,
      idempotencyKey: request.idempotencyKey,
      promise: execution,
      settled: false,
      tenant: scope.tenant,
    }
    this.#executions.push(cachedExecution)
    if (this.#executions.length > MAX_CACHED_EXECUTIONS) this.#executions.splice(0, this.#executions.length - MAX_CACHED_EXECUTIONS)
    void execution.then(
      () => { cachedExecution.settled = true },
      () => undefined,
    )
    void execution.catch(() => this.removeExecution(cachedExecution))
    return execution
  }

  private async run<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    request: ActionExecutionRequest<TInput, TRecordId>,
    scope: { readonly actor: TActor, readonly services: TServices, readonly signal: AbortSignal, readonly tenant: TTenant },
  ): Promise<ActionExecutionResult<TRecordId, TResult>> {
    if (request.mount !== definition.mount) throw new Error('Action requests cannot change their compiled mount')
    const recordIds = request.recordIds ?? []
    if (definition.mount === 'record') {
      if (recordIds.length !== 1) throw new Error('Record actions require exactly one allow-listed record ID')
    } else if (definition.mount === 'bulk') {
      if (recordIds.length === 0 || recordIds.length > MAX_BULK_RECORDS) {
        throw new Error(`Bulk actions require between 1 and ${MAX_BULK_RECORDS} allow-listed record IDs`)
      }
      if (new Set(recordIds).size !== recordIds.length) throw new Error('Bulk action record IDs must be unique')
    } else if (recordIds.length > 0) {
      throw new Error('Only record and bulk actions accept record IDs')
    }
    if (definition.mount === 'record' || definition.mount === 'bulk') {
      const executions: Array<RecordExecution<TRecord, TRecordId, TResult, TActor, TTenant, TServices>> = []
      for (const recordId of recordIds) executions.push(await this.executeRecord(definition, request, scope, recordId))
      const items = executions.map(execution => execution.item)
      const succeeded = items.every(item => item.status === 'succeeded')
      const effects = succeeded
        ? await this.successEffects(definition, executions.flatMap(execution => execution.item.status === 'succeeded' && 'result' in execution.item ? [{ context: execution.context, result: execution.item.result as TResult }] : []))
        : await this.failureEffects(definition, executions.filter(execution => execution.item.status !== 'succeeded').map(execution => execution.context))
      return Object.freeze({
        effects,
        items: Object.freeze(items),
        status: succeeded ? 'succeeded' : 'partial',
      })
    }
    const context = this.context(definition, scope, null)
    try {
      const result = await this.executeWithContext(definition, request.input, context)
      const effects = await this.successEffects(definition, [{ context, result }])
      return Object.freeze({ effects, items: Object.freeze([]), result, status: 'succeeded' })
    } catch (cause: unknown) {
      if (!definition.failureNotification) throw cause
      const effects = await this.failureEffects(definition, [context])
      if (cause instanceof ActionExecutionError) throw new ActionExecutionError(cause.code, cause.message, effects)
      throw new ActionExecutionError('failed', 'The action could not be completed', effects)
    }
  }

  private async executeRecord<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    request: ActionExecutionRequest<TInput, TRecordId>,
    scope: { readonly actor: TActor, readonly services: TServices, readonly signal: AbortSignal, readonly tenant: TTenant },
    recordId: TRecordId,
  ): Promise<RecordExecution<TRecord, TRecordId, TResult, TActor, TTenant, TServices>> {
    const record = await this.options.records.resolve(recordId, scope)
    const context = this.context(definition, scope, record)
    if (!record) return Object.freeze({ context, item: Object.freeze({ recordId, status: 'denied' }) })
    const expected = request.expectedVersions?.[String(recordId)]
    if (expected !== undefined && this.options.records.version(record) !== expected) return Object.freeze({ context, item: Object.freeze({ recordId, status: 'stale' }) })
    try {
      const result = await this.executeWithContext(definition, request.input, context)
      const item: ActionItemResult<TRecordId, TResult> = Object.freeze({ recordId, result, status: 'succeeded' })
      return Object.freeze({ context, item })
    } catch (cause: unknown) {
      if (cause instanceof ActionExecutionError && cause.code === 'denied') {
        return Object.freeze({ context, item: Object.freeze({ recordId, status: 'denied' }) })
      }
      return Object.freeze({ context, item: Object.freeze({ recordId, status: 'failed' }) })
    }
  }

  private context<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    scope: { readonly actor: TActor, readonly services: TServices, readonly signal: AbortSignal, readonly tenant: TTenant },
    record: TRecord | null,
  ): ActionContext<TRecord, TActor, TTenant, TServices> {
    return Object.freeze({ ...scope, mount: definition.mount, record })
  }

  private async executeWithContext<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    input: TInput,
    context: ActionContext<TRecord, TActor, TTenant, TServices>,
  ): Promise<TResult> {
    if (!await definition.authorize(context)) throw new ActionExecutionError('denied', 'The action is not authorized')
    await this.enforceRateLimit(definition, context)
    const mutated = definition.mutateInput ? await definition.mutateInput(structuredClone(input), context) : structuredClone(input)
    const operation = async (): Promise<TResult> => {
      await definition.lifecycle?.before?.(mutated, context)
      const result = await definition.handle(mutated, context)
      await definition.lifecycle?.after?.(result, context)
      for (const effect of definition.sideEffects ?? []) await effect(result, context)
      const notification = await definition.notification?.(result, context)
      if (notification && this.options.notifications) await this.options.notifications.send(notification, context)
      return result
    }
    return definition.transactional === false ? operation() : this.options.transaction.run(operation)
  }

  private async enforceRateLimit<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    context: ActionContext<TRecord, TActor, TTenant, TServices>,
  ): Promise<void> {
    const rateLimit = definition.rateLimit
    if (!rateLimit) return
    if (!Number.isSafeInteger(rateLimit.limit) || rateLimit.limit < 1) throw new Error('Action rate limits must be positive integers')
    if (!Number.isSafeInteger(rateLimit.windowMilliseconds) || rateLimit.windowMilliseconds < 1) {
      throw new Error('Action rate-limit windows must be positive integer milliseconds')
    }
    const resolvedKey = (await rateLimit.key(context)).trim()
    if (!resolvedKey || resolvedKey.length > 500) throw new Error('Action rate-limit keys must contain between 1 and 500 characters')
    const now = Date.now()
    const key = `${definition.id}\u0000${resolvedKey}`
    const current = this.#rateLimits.get(key)
    if (!current || current.expiresAt <= now) {
      this.#rateLimits.set(key, { count: 1, expiresAt: now + rateLimit.windowMilliseconds })
      if (this.#rateLimits.size > MAX_CACHED_EXECUTIONS) {
        for (const [storedKey, window] of this.#rateLimits) {
          if (window.expiresAt <= now) this.#rateLimits.delete(storedKey)
        }
        while (this.#rateLimits.size > MAX_CACHED_EXECUTIONS) {
          const oldestKey = this.#rateLimits.keys().next().value
          if (oldestKey === undefined) break
          this.#rateLimits.delete(oldestKey)
        }
      }
      return
    }
    if (current.count >= rateLimit.limit) throw new ActionExecutionError('rate-limited', 'The action rate limit was exceeded')
    current.count += 1
  }

  private async successEffects<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    executions: readonly { readonly context: ActionContext<TRecord, TActor, TTenant, TServices>, readonly result: TResult }[],
  ): Promise<readonly Effect[]> {
    if (!definition.successNotification) return Object.freeze([])
    const presentations: Readonly<PanelNotificationPresentation>[] = []
    for (const execution of executions) {
      try {
        const presentation = typeof definition.successNotification === 'function'
          ? await definition.successNotification(execution.result, execution.context)
          : definition.successNotification
        if (presentation) presentations.push(presentation)
      } catch {
        continue
      }
    }
    return this.notificationEffects(presentations)
  }

  private async failureEffects<TInput extends JsonObject, TResult>(
    definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>,
    contexts: readonly ActionContext<TRecord, TActor, TTenant, TServices>[],
  ): Promise<readonly Effect[]> {
    if (!definition.failureNotification) return Object.freeze([])
    const presentations: Readonly<PanelNotificationPresentation>[] = []
    for (const context of contexts) {
      try {
        const presentation = typeof definition.failureNotification === 'function'
          ? await definition.failureNotification(context)
          : definition.failureNotification
        if (presentation) presentations.push(presentation)
      } catch {
        continue
      }
    }
    return this.notificationEffects(presentations)
  }

  private notificationEffects(presentations: readonly Readonly<PanelNotificationPresentation>[]): readonly Effect[] {
    const effects = new Map<string, RichToastEffect>()
    for (const value of presentations) {
      const presentation = validatedToastPresentation(value)
      if (!presentation) continue
      if (effects.size >= MAX_RESPONSE_EFFECTS && !effects.has(presentation.id)) continue
      effects.set(presentation.id, Object.freeze({ kind: 'toast', presentation }))
    }
    return Object.freeze([...effects.values()])
  }

  private pruneExecutions(now: number): void {
    for (let index = this.#executions.length - 1; index >= 0; index -= 1) {
      if ((this.#executions[index]?.expiresAt ?? 0) <= now) this.#executions.splice(index, 1)
    }
  }

  private removeExecution(entry: CachedExecution<TRecordId>): void {
    const index = this.#executions.indexOf(entry)
    if (index >= 0) this.#executions.splice(index, 1)
  }
}
