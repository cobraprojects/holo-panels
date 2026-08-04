import type { TableRecordIdentifier } from '../tables/query/contracts'
import type {
  TransferExecutionInput,
  TransferFailureRows,
  TransferIdentity,
  TransferIdentityValue,
  TransferOperationIdentity,
  TransferOperationKind,
  TransferOperationRecord,
  TransferOperationStore,
  TransferOutboxRecord,
  TransferQueueConfiguration,
  TransferQueueEnvelope,
  TransferProgressTransition,
  TransferResultPart,
  TransferSanitizedError,
  TransferStoredArtifact,
} from './contracts'

export interface TransferDownloadTokenPayload {
  readonly artifact: 'failure-rows' | 'result'
  readonly expiresAt: Date
  readonly operationId: string
  readonly purpose: 'transfer-download'
}

export interface TransferDownloadGrant {
  readonly artifact: 'failure-rows' | 'result'
  readonly expiresAt: Date
  readonly operationId: string
  readonly token: string
}

export interface TransferLifecycleOptions<TRequestScope, TRecordId extends TableRecordIdentifier = TableRecordIdentifier> {
  readonly authorizeCancellation: (operation: TransferOperationRecord<TRecordId>, requestScope: TRequestScope) => boolean | Promise<boolean>
  readonly authorizeDownload: (operation: TransferOperationRecord<TRecordId>, requestScope: TRequestScope) => boolean | Promise<boolean>
  readonly clock?: () => Date
  readonly identifyActor: (requestScope: TRequestScope) => TransferIdentityValue
  readonly identifyGuard: (requestScope: TRequestScope) => string
  readonly identifyPanel: (requestScope: TRequestScope) => string
  readonly identifyProvider: (requestScope: TRequestScope) => string | null
  readonly identifyTenant: (requestScope: TRequestScope) => TransferIdentityValue | null
  readonly makeId: () => string
  readonly maxChunkRetries: number
  readonly retentionMilliseconds: number
  readonly signDownload: (payload: TransferDownloadTokenPayload) => string | Promise<string>
  readonly store: TransferOperationStore<TRecordId>
  readonly verifyDownload: (token: string) => TransferDownloadTokenPayload | null | Promise<TransferDownloadTokenPayload | null>
}

export interface CreateTransferOperationInput<TRecordId extends TableRecordIdentifier = TableRecordIdentifier> {
  readonly definitionId: string
  readonly definitionRevision: string
  readonly input: TransferExecutionInput<TRecordId>
  readonly kind: TransferOperationKind
  readonly queue: TransferQueueConfiguration
  readonly resourceId: string
  readonly total: number
}

export type TransferLifecycleErrorCode
  = 'cancel_denied' | 'download_denied' | 'download_expired' | 'invalid_configuration'
    | 'invalid_envelope' | 'invalid_operation' | 'invalid_progress' | 'operation_cancelled'
    | 'operation_conflict' | 'operation_terminal' | 'unknown_download' | 'unknown_operation'

export class TransferLifecycleError extends Error {
  constructor(readonly code: TransferLifecycleErrorCode, message: string) {
    super(message)
    this.name = 'TransferLifecycleError'
  }
}

export class TransferSafeError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'TransferSafeError'
  }
}

const safeIdentifier = /^[a-z0-9][a-z0-9._:-]{0,199}$/iu
const safeDigest = /^[a-f0-9]{64}$/u
const safeCode = /^[a-z][a-z0-9_]{0,63}$/u

function fail(code: TransferLifecycleErrorCode, message: string): never {
  throw new TransferLifecycleError(code, message)
}

function identifier(value: string, label: string): string {
  if (!safeIdentifier.test(value)) fail('invalid_operation', `${label} is invalid`)
  return value
}

function identity(value: TransferIdentityValue): TransferIdentity {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) fail('invalid_operation', 'Transfer identity is invalid')
  if (typeof value === 'string' && (!value || value.length > 200)) fail('invalid_operation', 'Transfer identity is invalid')
  return Object.freeze({ type: typeof value === 'number' ? 'number' : 'string', value })
}

function sameIdentity(left: TransferIdentity | null, right: TransferIdentity | null): boolean {
  if (left === null || right === null) return left === right
  return left.type === right.type && left.value === right.value
}

function sameOperationIdentity(left: TransferOperationIdentity, right: TransferOperationIdentity): boolean {
  return sameIdentity(left.actor, right.actor) && left.guard === right.guard && left.panelId === right.panelId
    && left.provider === right.provider && sameIdentity(left.tenant, right.tenant)
}

function artifact(value: TransferStoredArtifact): TransferStoredArtifact {
  if (!value.path || value.path.length > 1024 || value.path.includes('\0') || value.path.startsWith('/')) fail('invalid_operation', 'Transfer artifact path is invalid')
  if (!safeIdentifier.test(value.disk) || !value.filename || value.filename.length > 255 || /[/\\\0]/u.test(value.filename)) fail('invalid_operation', 'Transfer artifact location is invalid')
  if (!value.contentType || value.contentType.length > 200 || !Number.isSafeInteger(value.size) || value.size < 0
    || value.digest.algorithm !== 'sha256' || !safeDigest.test(value.digest.value)) fail('invalid_operation', 'Transfer artifact metadata is invalid')
  return Object.freeze({ ...value, digest: Object.freeze({ ...value.digest }) })
}

function operationSnapshot<TRecordId extends TableRecordIdentifier>(operation: TransferOperationRecord<TRecordId>): TransferOperationRecord<TRecordId> {
  const input = operation.input.kind === 'import'
    ? Object.freeze({ ...operation.input, mappings: Object.freeze(operation.input.mappings.map(value => Object.freeze({ ...value }))), source: artifact(operation.input.source) })
    : Object.freeze({ ...operation.input, columnIds: Object.freeze([...operation.input.columnIds]), selection: Object.freeze({ ...operation.input.selection }), tableState: Object.freeze({ ...operation.input.tableState }) })
  return Object.freeze({
    ...operation,
    artifact: operation.artifact ? artifact(operation.artifact) : null,
    cleanupAfter: operation.cleanupAfter ? new Date(operation.cleanupAfter) : null,
    createdAt: new Date(operation.createdAt),
    failure: operation.failure ? Object.freeze({ ...operation.failure }) : null,
    failureRows: operation.failureRows ? Object.freeze({ artifact: artifact(operation.failureRows.artifact), count: operation.failureRows.count }) : null,
    identity: Object.freeze({ ...operation.identity, actor: Object.freeze({ ...operation.identity.actor }), tenant: operation.identity.tenant ? Object.freeze({ ...operation.identity.tenant }) : null }),
    input,
    parts: Object.freeze(operation.parts.map(part => Object.freeze({ ...part, artifact: artifact(part.artifact) }))),
    progress: Object.freeze({ ...operation.progress }),
    updatedAt: new Date(operation.updatedAt),
  })
}

function sanitize(error: unknown): TransferSanitizedError {
  if (error instanceof TransferSafeError && safeCode.test(error.code)) {
    const message = [...error.message].map(character => {
      const point = character.codePointAt(0)!
      return point <= 31 || point === 127 ? ' ' : character
    }).join('').slice(0, 500)
    return Object.freeze({ code: error.code, message })
  }
  return Object.freeze({ code: 'operation_failed', message: 'Transfer operation failed' })
}

function progress(completed: number, total: number): void {
  if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(total) || completed < 0 || total < completed) fail('invalid_progress', 'Transfer progress must be bounded safe integers')
}

export class TransferOperationLifecycle<TRequestScope, TRecordId extends TableRecordIdentifier = TableRecordIdentifier> {
  readonly #options: TransferLifecycleOptions<TRequestScope, TRecordId> & { readonly clock: () => Date }

  constructor(options: TransferLifecycleOptions<TRequestScope, TRecordId>) {
    if (!Number.isSafeInteger(options.maxChunkRetries) || options.maxChunkRetries < 1 || !Number.isSafeInteger(options.retentionMilliseconds) || options.retentionMilliseconds < 1) fail('invalid_configuration', 'Transfer lifecycle limits are invalid')
    this.#options = { ...options, clock: options.clock ?? (() => new Date()) }
  }

  async create(input: CreateTransferOperationInput<TRecordId>, requestScope: TRequestScope): Promise<TransferOperationRecord<TRecordId>> {
    progress(0, input.total)
    if (input.input.kind !== input.kind || !safeDigest.test(input.definitionRevision)) fail('invalid_operation', 'Transfer execution input is invalid')
    const now = this.#options.clock()
    const operation = operationSnapshot<TRecordId>({
      artifact: null, cleanupAfter: null, createdAt: now, definitionId: identifier(input.definitionId, 'Transfer definition identifier'),
      definitionRevision: input.definitionRevision, failure: null, failureRows: null, id: identifier(this.#options.makeId(), 'Transfer operation identifier'),
      identity: this.deriveIdentity(requestScope), input: input.input, kind: input.kind, progress: Object.freeze({ completed: 0, total: input.total }),
      parts: Object.freeze([]), resourceId: identifier(input.resourceId, 'Transfer resource identifier'), revision: 0, status: 'queued', updatedAt: now,
    })
    await this.#options.store.create(operation, [this.queueOutbox(operation, 0, 0, input.queue, now)])
    return operation
  }

  async claim(value: unknown): Promise<TransferOperationRecord<TRecordId>> {
    const envelope = this.validateEnvelope(value)
    const operation = await this.operation(envelope.operationId)
    if (!this.matches(envelope, operation) || operation.status !== 'queued') fail('invalid_envelope', 'Transfer queue envelope is stale or invalid')
    return this.save(operation, { status: 'running' }, [])
  }

  async progress(operationId: string, transition: TransferProgressTransition): Promise<TransferOperationRecord<TRecordId>> {
    const operation = await this.operation(operationId)
    this.active(operation)
    if (transition.kind !== operation.kind) fail('invalid_progress', 'Transfer progress kind must match the operation')
    progress(transition.completed, operation.progress.total)
    if (transition.completed < operation.progress.completed) fail('invalid_progress', 'Transfer progress must be monotonic')
    if (transition.completed === operation.progress.completed) fail('invalid_progress', 'Transfer progress must advance')
    if (transition.next && (!Number.isSafeInteger(transition.next.chunk) || transition.next.chunk < 0)) fail('invalid_progress', 'Transfer next chunk is invalid')
    let parts = operation.parts
    if (transition.kind === 'export') {
      const part = this.resultPart(transition.part)
      if (part.chunk !== operation.parts.length || part.rows > operation.progress.total
        || transition.completed !== operation.progress.completed + part.rows) fail('invalid_progress', 'Transfer result parts must be contiguous and bounded')
      if (!transition.next || transition.next.chunk !== part.chunk + 1) fail('invalid_progress', 'Export progress must queue its next revision')
      parts = Object.freeze([...operation.parts, part])
    } else if (operation.parts.length > 0) {
      fail('invalid_progress', 'Import operations cannot contain result parts')
    }
    const updated = this.updated(operation, { parts, progress: Object.freeze({ completed: transition.completed, total: operation.progress.total }), status: transition.next ? 'queued' : 'running' })
    const outbox = transition.next ? [this.queueOutbox(updated, transition.next.chunk, 0, transition.next.configuration, updated.updatedAt)] : []
    return this.commit(operation, updated, outbox)
  }

  async retry(value: unknown, error: unknown, configuration: TransferQueueConfiguration): Promise<TransferOperationRecord<TRecordId>> {
    const envelope = this.validateEnvelope(value)
    const operation = await this.operation(envelope.operationId)
    if (!this.matches(envelope, operation)) fail('invalid_envelope', 'Transfer queue envelope is stale or invalid')
    this.active(operation)
    if (envelope.attempt >= this.#options.maxChunkRetries) return this.failOperation(operation, error)
    const updated = this.updated(operation, { status: 'queued' })
    return this.commit(operation, updated, [this.queueOutbox(updated, envelope.chunk, envelope.attempt + 1, configuration, updated.updatedAt)])
  }

  async complete(operationId: string, result: TransferStoredArtifact | null, rows: TransferFailureRows | null = null): Promise<TransferOperationRecord<TRecordId>> {
    const operation = await this.operation(operationId)
    if (operation.status === 'completed') return operation
    this.active(operation)
    if (operation.kind === 'export' && (operation.progress.completed !== operation.progress.total
      || operation.parts.reduce((total, part) => total + part.rows, 0) !== operation.progress.total)) {
      fail('invalid_progress', 'Export result parts are incomplete')
    }
    return this.finish(operation, { artifact: result ? artifact(result) : null, failureRows: rows ? this.failureRows(rows) : null, progress: Object.freeze({ completed: operation.progress.total, total: operation.progress.total }), status: 'completed' }, 'completed')
  }

  async fail(operationId: string, error: unknown, rows: TransferFailureRows | null = null): Promise<TransferOperationRecord<TRecordId>> {
    const operation = await this.operation(operationId)
    if (operation.status === 'failed' || operation.status === 'completed') return operation
    if (operation.status === 'cancelled') fail('operation_cancelled', 'Transfer operation was cancelled')
    return this.failOperation(operation, error, rows)
  }

  async cancel(operationId: string, requestScope: TRequestScope): Promise<TransferOperationRecord<TRecordId>> {
    const operation = await this.operation(operationId)
    if (!sameOperationIdentity(operation.identity, this.deriveIdentity(requestScope)) || !await this.#options.authorizeCancellation(operation, requestScope)) fail('cancel_denied', 'Transfer cancellation was denied')
    if (operation.status === 'cancelled') return operation
    if (operation.status === 'completed' || operation.status === 'failed') fail('operation_terminal', 'Finished transfer operations cannot be cancelled')
    const now = this.#options.clock()
    return this.save(operation, { cleanupAfter: new Date(now.getTime() + this.#options.retentionMilliseconds), status: 'cancelled' }, [])
  }

  async createDownloadGrant(operationId: string, kind: 'failure-rows' | 'result', scope: TRequestScope, expiresAt: Date): Promise<TransferDownloadGrant> {
    const operation = await this.authorizedDownload(operationId, kind, scope)
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= this.#options.clock()) fail('download_expired', 'Transfer download grant is expired')
    const token = await this.#options.signDownload(Object.freeze({ artifact: kind, expiresAt: new Date(expiresAt), operationId: operation.id, purpose: 'transfer-download' }))
    if (!token) fail('invalid_operation', 'Transfer download token is invalid')
    return Object.freeze({ artifact: kind, expiresAt: new Date(expiresAt), operationId, token })
  }

  async resolveDownload(token: string, scope: TRequestScope): Promise<TransferStoredArtifact> {
    const payload = await this.#options.verifyDownload(token)
    if (!payload || payload.purpose !== 'transfer-download' || !(payload.expiresAt instanceof Date) || !Number.isFinite(payload.expiresAt.getTime()) || (payload.artifact !== 'failure-rows' && payload.artifact !== 'result')) fail('unknown_download', 'Transfer download is unavailable')
    if (payload.expiresAt <= this.#options.clock()) fail('download_expired', 'Transfer download grant is expired')
    const operation = await this.authorizedDownload(payload.operationId, payload.artifact, scope)
    return artifact(payload.artifact === 'result' ? operation.artifact! : operation.failureRows!.artifact)
  }

  async cleanupEligible(limit: number, at = this.#options.clock()): Promise<readonly TransferOperationRecord<TRecordId>[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) fail('invalid_configuration', 'Cleanup limit must be between 1 and 1000')
    return Object.freeze((await this.#options.store.cleanupEligible(at, limit)).map(operationSnapshot<TRecordId>))
  }

  delete(operationId: string, expectedRevision: number): Promise<boolean> { return this.#options.store.delete(operationId, expectedRevision) }
  get(operationId: string): Promise<TransferOperationRecord<TRecordId>> { return this.operation(operationId) }

  private async authorizedDownload(operationId: string, kind: 'failure-rows' | 'result', scope: TRequestScope): Promise<TransferOperationRecord<TRecordId>> {
    const operation = await this.operation(operationId)
    const stored = kind === 'result' ? operation.artifact : operation.failureRows?.artifact
    if (!stored || !sameOperationIdentity(operation.identity, this.deriveIdentity(scope)) || !await this.#options.authorizeDownload(operation, scope)) fail('download_denied', 'Transfer download was denied')
    return operation
  }

  private active(operation: TransferOperationRecord<TRecordId>): void {
    if (operation.status === 'cancelled') fail('operation_cancelled', 'Transfer operation was cancelled')
    if (operation.status === 'completed' || operation.status === 'failed') fail('operation_terminal', 'Transfer operation is already finished')
  }

  private deriveIdentity(scope: TRequestScope): TransferOperationIdentity {
    const tenant = this.#options.identifyTenant(scope)
    const provider = this.#options.identifyProvider(scope)
    return Object.freeze({ actor: identity(this.#options.identifyActor(scope)), guard: identifier(this.#options.identifyGuard(scope), 'Transfer guard identifier'), panelId: identifier(this.#options.identifyPanel(scope), 'Transfer panel identifier'), provider: provider === null ? null : identifier(provider, 'Transfer provider identifier'), tenant: tenant === null ? null : identity(tenant) })
  }

  private failureRows(rows: TransferFailureRows): TransferFailureRows {
    if (!Number.isSafeInteger(rows.count) || rows.count < 1) fail('invalid_operation', 'Transfer failure rows are invalid')
    return Object.freeze({ artifact: artifact(rows.artifact), count: rows.count })
  }

  private resultPart(part: TransferResultPart): TransferResultPart {
    if (!Number.isSafeInteger(part.chunk) || part.chunk < 0 || !Number.isSafeInteger(part.rows) || part.rows < 1) fail('invalid_progress', 'Transfer result part bounds are invalid')
    return Object.freeze({ artifact: artifact(part.artifact), chunk: part.chunk, rows: part.rows })
  }

  private finish(operation: TransferOperationRecord<TRecordId>, patch: Partial<TransferOperationRecord<TRecordId>>, status: 'completed' | 'failed'): Promise<TransferOperationRecord<TRecordId>> {
    const now = this.#options.clock()
    const updated = this.updated(operation, { ...patch, cleanupAfter: new Date(now.getTime() + this.#options.retentionMilliseconds) })
    return this.commit(operation, updated, [this.notificationOutbox(updated, status, now)])
  }

  private failOperation(operation: TransferOperationRecord<TRecordId>, error: unknown, rows: TransferFailureRows | null = null): Promise<TransferOperationRecord<TRecordId>> {
    return this.finish(operation, { failure: sanitize(error), failureRows: rows ? this.failureRows(rows) : null, status: 'failed' }, 'failed')
  }

  private async operation(id: string): Promise<TransferOperationRecord<TRecordId>> {
    const operation = await this.#options.store.find(id)
    if (!operation) fail('unknown_operation', 'Transfer operation was not found')
    return operationSnapshot(operation)
  }

  private updated(operation: TransferOperationRecord<TRecordId>, patch: Partial<TransferOperationRecord<TRecordId>>): TransferOperationRecord<TRecordId> {
    return operationSnapshot({ ...operation, ...patch, revision: operation.revision + 1, updatedAt: this.#options.clock() })
  }

  private save(operation: TransferOperationRecord<TRecordId>, patch: Partial<TransferOperationRecord<TRecordId>>, outbox: readonly TransferOutboxRecord[]): Promise<TransferOperationRecord<TRecordId>> {
    return this.commit(operation, this.updated(operation, patch), outbox)
  }

  private async commit(previous: TransferOperationRecord<TRecordId>, updated: TransferOperationRecord<TRecordId>, outbox: readonly TransferOutboxRecord[]): Promise<TransferOperationRecord<TRecordId>> {
    if (!await this.#options.store.compareAndSwap(previous.id, previous.revision, updated, outbox)) fail('operation_conflict', 'Transfer operation changed concurrently')
    return updated
  }

  private envelope(operation: TransferOperationRecord<TRecordId>, chunk: number, attempt: number): TransferQueueEnvelope {
    return Object.freeze({ attempt, chunk, definitionId: operation.definitionId, definitionRevision: operation.definitionRevision, kind: operation.kind, operationId: operation.id, operationRevision: operation.revision, panelId: operation.identity.panelId, version: 2 })
  }

  private queueOutbox(operation: TransferOperationRecord<TRecordId>, chunk: number, attempt: number, configuration: TransferQueueConfiguration, now: Date): TransferOutboxRecord {
    return this.outbox(operation, Object.freeze({ configuration: Object.freeze({ ...configuration }), envelope: this.envelope(operation, chunk, attempt), kind: 'queue' }), now)
  }

  private notificationOutbox(operation: TransferOperationRecord<TRecordId>, status: 'completed' | 'failed', now: Date): TransferOutboxRecord {
    return this.outbox(operation, Object.freeze({ kind: 'notification', status }), now)
  }

  private outbox(operation: TransferOperationRecord<TRecordId>, event: TransferOutboxRecord['event'], now: Date): TransferOutboxRecord {
    return Object.freeze({ attempt: 0, availableAt: new Date(now), createdAt: new Date(now), event, id: identifier(this.#options.makeId(), 'Transfer outbox identifier'), leaseExpiresAt: null, operationId: operation.id, operationRevision: operation.revision, revision: 0, updatedAt: new Date(now) })
  }

  private matches(envelope: TransferQueueEnvelope, operation: TransferOperationRecord<TRecordId>): boolean {
    return envelope.operationRevision === operation.revision && envelope.definitionId === operation.definitionId && envelope.definitionRevision === operation.definitionRevision && envelope.kind === operation.kind && envelope.panelId === operation.identity.panelId && envelope.attempt <= this.#options.maxChunkRetries
  }

  private validateEnvelope(value: unknown): TransferQueueEnvelope {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('invalid_envelope', 'Transfer queue envelope is invalid')
    const envelope = value as Partial<TransferQueueEnvelope>
    if (envelope.version !== 2 || (envelope.kind !== 'export' && envelope.kind !== 'import') || typeof envelope.operationId !== 'string' || typeof envelope.definitionId !== 'string' || typeof envelope.definitionRevision !== 'string' || typeof envelope.panelId !== 'string' || !Number.isSafeInteger(envelope.operationRevision) || envelope.operationRevision! < 0 || !Number.isSafeInteger(envelope.chunk) || envelope.chunk! < 0 || !Number.isSafeInteger(envelope.attempt) || envelope.attempt! < 0) fail('invalid_envelope', 'Transfer queue envelope is invalid')
    return Object.freeze(envelope as TransferQueueEnvelope)
  }
}
