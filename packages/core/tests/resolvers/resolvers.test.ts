import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  clientExpression,
  clientResolver,
  createServerResolverRequest,
  formResolverContextFor,
  literal,
  nullResolver,
  ResolverDependencyCycleError,
  serverResolver,
  ServerResolverBatcher,
  type FormResolverContext,
} from '../../src/resolvers'

class FormValues {
  declare account: {
    active: boolean
    name: string
  }
  declare branch: 'company' | 'person'
  declare companyName: string
  declare personName: string
  declare rows: readonly { total: number }[]
}

const ResolverContext = formResolverContextFor(FormValues)

const values: FormValues = {
  account: { active: true, name: 'Ada' },
  branch: 'company',
  companyName: 'Holo',
  personName: 'Ada',
  rows: [{ total: 12 }],
}

function formContext(nextValues: FormValues = values) {
  return {
    domain: 'form' as const,
    values: nextValues,
    record: undefined,
    actor: undefined,
    tenant: undefined,
    services: undefined,
    locale: 'en',
  }
}

describe('resolver definitions', () => {
  it('defines literal, null, client expression, and named client values', () => {
    expect(literal('Name')).toEqual({ kind: 'literal', value: 'Name' })
    expect(nullResolver()).toEqual({ kind: 'null', value: null })
    expect(clientExpression(Boolean, { operator: 'equals', operands: [1, 1] })).toEqual({
      kind: 'client-expression',
      expression: { operator: 'equals', operands: [1, 1] },
    })
    expect(clientResolver(String, 'format.slug', 'Post Title')).toEqual({
      kind: 'named-client-resolver',
      name: 'format.slug',
      input: 'Post Title',
    })
  })

  it('preserves concrete nested and array path inference', async () => {
    const resolver = serverResolver('form.account-label', ResolverContext, async context => {
      const name = context.get('account.name')
      const total = context.get('rows.0.total')
      expectTypeOf(name).toEqualTypeOf<string>()
      expectTypeOf(total).toEqualTypeOf<number>()
      return `${name}:${total}`
    })
    const request = createServerResolverRequest('account-label', resolver, formContext())
    const result = await new ServerResolverBatcher().resolve({ scope: 'form', version: 1, requests: [request] })

    expect(result.patches[0]).toEqual({
      target: 'account-label',
      dependencies: ['account.name', 'rows.0.total'],
      value: 'Ada:12',
    })
  })
})

describe('server resolver batching', () => {
  it('merges explicit and observed dependencies into one sorted patch', async () => {
    const resolver = serverResolver('form.display-name', ResolverContext, context => context.get('account.name'), ['account.active', 'account.name'])
    const request = createServerResolverRequest('display-name', resolver, formContext())

    const result = await new ServerResolverBatcher().resolve({ scope: 'form', version: 1, requests: [request] })

    expect(result.patches).toEqual([{
      target: 'display-name',
      dependencies: ['account.active', 'account.name'],
      value: 'Ada',
    }])
  })

  it('tracks only the dependencies observed by the active branch', async () => {
    const resolver = (context: FormResolverContext<FormValues>) => context.get('branch') === 'company'
      ? context.get('companyName')
      : context.get('personName')
    const batcher = new ServerResolverBatcher()
    const company = await batcher.resolve({
      scope: 'branch-form',
      version: 1,
      requests: [createServerResolverRequest('name', resolver, formContext())],
    })
    const person = await batcher.resolve({
      scope: 'branch-form',
      version: 2,
      requests: [createServerResolverRequest('name', resolver, formContext({ ...values, branch: 'person' }))],
    })

    expect(company.patches[0]?.dependencies).toEqual(['branch', 'companyName'])
    expect(person.patches[0]?.dependencies).toEqual(['branch', 'personName'])
  })

  it('awaits async resolvers concurrently and returns one ordered batch', async () => {
    const order: string[] = []
    const first = createServerResolverRequest('first', async () => {
      await Promise.resolve()
      order.push('first')
      return 1
    }, formContext())
    const second = createServerResolverRequest('second', async () => {
      order.push('second')
      return 2
    }, formContext())

    const result = await new ServerResolverBatcher().resolve({ scope: 'async', version: 1, requests: [first, second] })

    expect(order).toEqual(['second', 'first'])
    expect(result.patches.map(patch => [patch.target, patch.value])).toEqual([['first', 1], ['second', 2]])
  })

  it('discards an older batch that finishes after a newer version', async () => {
    let release: ((value: string) => void) | undefined
    const slowValue = new Promise<string>(resolve => { release = resolve })
    const batcher = new ServerResolverBatcher()
    const older = batcher.resolve({
      scope: 'race',
      version: 1,
      requests: [createServerResolverRequest('name', async () => slowValue, formContext())],
    })
    const newer = await batcher.resolve({
      scope: 'race',
      version: 2,
      requests: [createServerResolverRequest('name', () => 'new', formContext())],
    })
    release?.('old')

    expect(newer).toEqual(expect.objectContaining({ stale: false, version: 2 }))
    await expect(older).resolves.toEqual({ scope: 'race', version: 1, stale: true, patches: [] })
  })

  it('reports complete explicit and observed dependency cycles', async () => {
    const batcher = new ServerResolverBatcher()
    const explicitRequests = [
      createServerResolverRequest('a', serverResolver('cycle.a', () => true, ['b']), formContext()),
      createServerResolverRequest('b', serverResolver('cycle.b', () => true, ['c']), formContext()),
      createServerResolverRequest('c', serverResolver('cycle.c', () => true, ['a']), formContext()),
    ]
    await expect(batcher.resolve({ scope: 'explicit-cycle', version: 1, requests: explicitRequests }))
      .rejects.toMatchObject({ dependencyPath: ['a', 'b', 'c', 'a'] })

    const observedRequests = [
      createServerResolverRequest('companyName', (context: FormResolverContext<FormValues>) => context.get('personName'), formContext()),
      createServerResolverRequest('personName', (context: FormResolverContext<FormValues>) => context.get('companyName'), formContext()),
    ]
    await expect(batcher.resolve({ scope: 'observed-cycle', version: 1, requests: observedRequests }))
      .rejects.toBeInstanceOf(ResolverDependencyCycleError)
    await expect(batcher.resolve({ scope: 'observed-cycle-2', version: 1, requests: observedRequests }))
      .rejects.toThrow('companyName -> personName -> companyName')
  })

  it('returns safe production and useful stack-free development errors', async () => {
    const failure = serverResolver('form.failure', () => {
      throw new Error('Database password secret with stack')
    })
    const request = createServerResolverRequest('status', failure, formContext())
    const batcher = new ServerResolverBatcher()

    const production = await batcher.resolve({ scope: 'errors-production', version: 1, requests: [request] })
    const development = await batcher.resolve({
      scope: 'errors-development',
      version: 1,
      requests: [request],
      environment: 'development',
    })

    expect(production.patches[0]?.error).toEqual({
      code: 'resolver_failed',
      message: 'Unable to resolve this component.',
      resolverId: 'form.failure',
      target: 'status',
    })
    expect(JSON.stringify(production)).not.toContain('Database password')
    expect(development.patches[0]?.error?.message).toBe('Database password secret with stack')
    expect(development.patches[0]?.error).not.toHaveProperty('stack')
  })

  it('rejects non-JSON server values as safe component failures', async () => {
    const request = createServerResolverRequest('total', () => Number.NaN, formContext())
    const result = await new ServerResolverBatcher().resolve({ scope: 'unsafe-value', version: 1, requests: [request] })

    expect(result.patches).toEqual([{
      target: 'total',
      dependencies: [],
      error: {
        code: 'resolver_failed',
        message: 'Unable to resolve this component.',
        target: 'total',
      },
    }])
  })

  it('rejects oversized batches before invoking server resolvers', async () => {
    const resolver = vi.fn(async () => true)
    const requests = Array.from({ length: 101 }, (_, index) => createServerResolverRequest(`field-${index}`, resolver, formContext()))

    await expect(new ServerResolverBatcher().resolve({ scope: 'oversized', version: 1, requests }))
      .rejects.toThrow('cannot exceed 100 requests')
    expect(resolver).not.toHaveBeenCalled()
  })
})
