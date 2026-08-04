import { describe, expect, it } from 'vitest'
import type { TransferOperationRecord, TransferQueueEnvelope, TransferStoredArtifact } from '../src/transfers/contracts'
import { TransferOperationLifecycle, TransferSafeError, type TransferDownloadTokenPayload } from '../src/transfers/lifecycle'
import { MemoryTransferStore } from './helpers/transfer-store'

interface Scope { readonly actorId: number, readonly guard: string, readonly panelId: string, readonly tenantId: string }
const digest = 'a'.repeat(64)
const definitionRevision = 'b'.repeat(64)
const stored: TransferStoredArtifact = Object.freeze({ contentType: 'text/csv', digest: { algorithm: 'sha256' as const, value: digest }, disk: 'private', filename: 'input.csv', path: 'transfers/input.csv', size: 12 })
const scope = (patch: Partial<Scope> = {}): Scope => ({ actorId: 1, guard: 'admin', panelId: 'admin', tenantId: 'tenant-a', ...patch })
const input = Object.freeze({ definitionId: 'users', definitionRevision, input: { formatId: 'csv', kind: 'import' as const, mappings: [{ column: 'email', header: 'Email' }], source: stored }, kind: 'import' as const, queue: { connection: 'database' }, resourceId: 'users', total: 10 })

function harness() {
  let now = new Date('2026-07-29T10:00:00.000Z')
  let sequence = 0
  const store = new MemoryTransferStore()
  const tokens = new Map<string, TransferDownloadTokenPayload>()
  const lifecycle = new TransferOperationLifecycle<Scope>({
    authorizeCancellation: () => true,
    authorizeDownload: () => true,
    clock: () => new Date(now),
    identifyActor: current => current.actorId,
    identifyGuard: current => current.guard,
    identifyPanel: current => current.panelId,
    identifyProvider: () => null,
    identifyTenant: current => current.tenantId,
    makeId: () => `id-${++sequence}`,
    maxChunkRetries: 2,
    retentionMilliseconds: 60_000,
    signDownload: payload => { const token = `token-${tokens.size + 1}`; tokens.set(token, payload); return token },
    store,
    verifyDownload: token => tokens.get(token) ?? null,
  })
  return { lifecycle, setNow: (value: string) => { now = new Date(value) }, store }
}

async function initialEnvelope(store: MemoryTransferStore): Promise<TransferQueueEnvelope> {
  const lease = await store.claimOutbox({ availableBefore: new Date('2026-07-29T10:00:00.000Z'), leaseMilliseconds: 1000, limit: 1 })
  const event = lease.records[0]!.event
  if (event.kind !== 'queue') throw new Error('expected queue event')
  return event.envelope
}

describe('P15 durable transfer lifecycle', () => {
  it('atomically persists immutable normalized input and a revisioned v2 queue event', async () => {
    const { lifecycle, store } = harness()
    const operation = await lifecycle.create(input, scope())
    const envelope = await initialEnvelope(store)
    expect(operation).toMatchObject({ definitionRevision, input: { kind: 'import', source: { digest: { value: digest } } }, revision: 0 })
    expect(envelope).toEqual(expect.objectContaining({ definitionRevision, operationId: operation.id, operationRevision: 0, version: 2 }))
    expect(JSON.stringify(envelope)).not.toContain('tenant-a')
    expect(Object.isFrozen(operation.input)).toBe(true)
  })

  it('rejects stale, substituted, and duplicate worker envelopes', async () => {
    const { lifecycle, store } = harness()
    await lifecycle.create(input, scope())
    const envelope = await initialEnvelope(store)
    await expect(lifecycle.claim({ ...envelope, definitionRevision: digest })).rejects.toMatchObject({ code: 'invalid_envelope' })
    await expect(lifecycle.claim(envelope)).resolves.toMatchObject({ revision: 1, status: 'running' })
    await expect(lifecycle.claim(envelope)).rejects.toMatchObject({ code: 'invalid_envelope' })
  })

  it('commits monotonic progress and the next chunk dispatch in one revision', async () => {
    const { lifecycle, store } = harness()
    await lifecycle.create(input, scope())
    await lifecycle.claim(await initialEnvelope(store))
    const advanced = await lifecycle.progress('id-1', { completed: 5, kind: 'import', next: { chunk: 1, configuration: { queue: 'transfers' } } })
    expect(advanced).toMatchObject({ progress: { completed: 5 }, revision: 2, status: 'queued' })
    expect([...store.outbox.values()].some(record => record.operationRevision === 2 && record.event.kind === 'queue')).toBe(true)
    await expect(lifecycle.progress('id-1', { completed: 4, kind: 'import', next: null })).rejects.toMatchObject({ code: 'invalid_progress' })
  })

  it('persists bounded retries and a single terminal failure notification', async () => {
    const { lifecycle, store } = harness()
    await lifecycle.create(input, scope())
    const first = await initialEnvelope(store)
    await lifecycle.claim(first)
    const retried = await lifecycle.retry({ ...first, operationRevision: 1 }, new Error('secret'), { backoff: 10 })
    const retryEvent = [...store.outbox.values()].find(record => record.operationRevision === retried.revision && record.event.kind === 'queue')!
    if (retryEvent.event.kind !== 'queue') throw new Error('expected queue')
    await lifecycle.claim(retryEvent.event.envelope)
    const failed = await lifecycle.retry({ ...retryEvent.event.envelope, attempt: 2, operationRevision: 3 }, new Error('/srv/secret'), {})
    expect(failed).toMatchObject({ failure: { code: 'operation_failed', message: 'Transfer operation failed' }, status: 'failed' })
    expect([...store.outbox.values()].filter(record => record.event.kind === 'notification')).toHaveLength(1)
  })

  it('makes completion and cancellation terminal under revision races', async () => {
    const { lifecycle, store } = harness()
    const operation = await lifecycle.create(input, scope())
    await lifecycle.complete(operation.id, null)
    await expect(lifecycle.cancel(operation.id, scope())).rejects.toMatchObject({ code: 'operation_terminal' })
    expect([...store.outbox.values()].filter(record => record.event.kind === 'notification')).toHaveLength(1)
  })

  it('binds downloads to identity, purpose, expiry, and artifact digest', async () => {
    const { lifecycle, setNow } = harness()
    const operation = await lifecycle.create(input, scope())
    await lifecycle.fail(operation.id, new TransferSafeError('invalid_rows', 'Rows failed'), { artifact: stored, count: 2 })
    const grant = await lifecycle.createDownloadGrant(operation.id, 'failure-rows', scope(), new Date('2026-07-29T10:01:00.000Z'))
    await expect(lifecycle.resolveDownload(grant.token, scope({ actorId: 2 }))).rejects.toMatchObject({ code: 'download_denied' })
    await expect(lifecycle.resolveDownload(grant.token, scope())).resolves.toEqual(stored)
    setNow('2026-07-29T10:01:00.000Z')
    await expect(lifecycle.resolveDownload(grant.token, scope())).rejects.toMatchObject({ code: 'download_expired' })
  })
})
