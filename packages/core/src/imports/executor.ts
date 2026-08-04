import type { CompiledImportMapping, ImportValues } from './mapping'

export interface ImportExecutionContext<TActor, TTenant> {
  readonly actor: TActor
  readonly importId: string
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface ImportRowContext<TActor, TTenant> extends ImportExecutionContext<TActor, TTenant> {
  readonly row: number
}

export interface ImportTransaction {
  run<TResult>(operation: () => Promise<TResult>): Promise<TResult>
}

export type ImportMutationChoice<TRecord> = { readonly kind: 'create' } | { readonly kind: 'update', readonly record: TRecord }

export interface ImportMutationPersistence<TRecord, TActor, TTenant> {
  choose(values: ImportValues, context: ImportRowContext<TActor, TTenant>): Promise<ImportMutationChoice<TRecord>>
  create(values: ImportValues, context: ImportRowContext<TActor, TTenant>): Promise<TRecord>
  update(record: TRecord, values: ImportValues, context: ImportRowContext<TActor, TTenant>): Promise<TRecord>
}

export interface ImportSecurity<TRecord, TActor, TTenant> {
  authorizeTenant(context: ImportRowContext<TActor, TTenant>): void | Promise<void>
  authorizeCreate(context: ImportRowContext<TActor, TTenant>): void | Promise<void>
  authorizeUpdate(record: TRecord, context: ImportRowContext<TActor, TTenant>): void | Promise<void>
}

export type ImportIdempotencyResult<TResult>
  = { readonly status: 'duplicate' }
    | { readonly status: 'executed', readonly value: TResult }

export interface ImportIdempotency {
  run<TResult>(key: string, operation: () => Promise<TResult>): Promise<ImportIdempotencyResult<TResult>>
}

export interface ImportRowValidator<TActor, TTenant> {
  validate(values: ImportValues, context: ImportRowContext<TActor, TTenant>): void | Promise<void>
}

export interface ImportExecutorOptions<TRecord, TActor, TTenant> {
  readonly idempotency: ImportIdempotency
  readonly mapping: CompiledImportMapping<ImportRowContext<TActor, TTenant>>
  readonly persistence: ImportMutationPersistence<TRecord, TActor, TTenant>
  readonly security: ImportSecurity<TRecord, TActor, TTenant>
  readonly transaction: ImportTransaction
  readonly validator: ImportRowValidator<TActor, TTenant>
  duplicateKey(values: ImportValues, context: ImportRowContext<TActor, TTenant>): string | Promise<string>
}

export class ImportRowError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ImportRowError'
  }
}

export interface ImportRowFailure {
  readonly code: string
  readonly message: string
  readonly row: number
  readonly source: Readonly<Record<string, string>>
}

export interface ImportExecutionResult<TRecord> {
  readonly created: readonly TRecord[]
  readonly failures: readonly ImportRowFailure[]
  readonly skipped: number
  readonly updated: readonly TRecord[]
}

function failure(error: unknown, row: number, source: Readonly<Record<string, string>>): ImportRowFailure {
  const safeSource = Object.freeze({ ...source })
  if (error instanceof ImportRowError) return Object.freeze({ code: error.code, message: error.message, row, source: safeSource })
  return Object.freeze({ code: 'row_failed', message: 'Import row failed', row, source: safeSource })
}

function assertIdempotencyPart(value: string): void {
  const hasControlCharacter = [...value].some(character => {
    const codePoint = character.codePointAt(0)!
    return codePoint <= 31 || codePoint === 127
  })
  if (!value || value.length > 512 || hasControlCharacter) {
    throw new ImportRowError('invalid_idempotency_key', 'Import row idempotency key is invalid')
  }
}

export class ImportExecutor<TRecord, TActor, TTenant> {
  readonly #options: ImportExecutorOptions<TRecord, TActor, TTenant>

  constructor(options: ImportExecutorOptions<TRecord, TActor, TTenant>) {
    this.#options = options
  }

  async execute(
    rows: readonly Readonly<Record<string, string>>[],
    context: ImportExecutionContext<TActor, TTenant>,
  ): Promise<ImportExecutionResult<TRecord>> {
    assertIdempotencyPart(context.importId)
    const created: TRecord[] = []
    const failures: ImportRowFailure[] = []
    const updated: TRecord[] = []
    let skipped = 0

    for (let index = 0; index < rows.length; index += 1) {
      if (context.signal.aborted) throw context.signal.reason
      const source = rows[index]!
      const rowContext = Object.freeze({ ...context, row: index + 1 })
      try {
        const outcome = await this.executeRow(source, rowContext)
        if (outcome.status === 'duplicate') {
          skipped += 1
        } else if (outcome.value.kind === 'create') {
          created.push(outcome.value.record)
        } else {
          updated.push(outcome.value.record)
        }
      } catch (error) {
        failures.push(failure(error, rowContext.row, source))
      }
    }

    return Object.freeze({
      created: Object.freeze(created),
      failures: Object.freeze(failures),
      skipped,
      updated: Object.freeze(updated),
    })
  }

  private async executeRow(
    source: Readonly<Record<string, string>>,
    context: ImportRowContext<TActor, TTenant>,
  ): Promise<ImportIdempotencyResult<{ readonly kind: 'create' | 'update', readonly record: TRecord }>> {
    await this.#options.security.authorizeTenant(context)
    const values = await this.#options.mapping.map(source, { context, row: context.row })
    const duplicateKey = await this.#options.duplicateKey(values, context)
    assertIdempotencyPart(duplicateKey)
    const idempotencyKey = JSON.stringify([context.importId, duplicateKey])

    return this.#options.idempotency.run(idempotencyKey, async () => this.#options.transaction.run(async () => {
      await this.#options.security.authorizeTenant(context)
      await this.#options.validator.validate(values, context)
      const choice = await this.#options.persistence.choose(values, context)
      if (choice.kind === 'create') {
        await this.#options.security.authorizeCreate(context)
        return { kind: 'create' as const, record: await this.#options.persistence.create(values, context) }
      }
      await this.#options.security.authorizeUpdate(choice.record, context)
      return { kind: 'update' as const, record: await this.#options.persistence.update(choice.record, values, context) }
    }))
  }
}
