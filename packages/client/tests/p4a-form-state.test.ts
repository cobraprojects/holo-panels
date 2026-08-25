import { defineSchema, schemaComponentsFor } from '@holo-js/panels-core'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { FormStore } from '../src/forms/store'
import type {
  FormPath,
  FormRequestContext,
  FormState,
  FormValueAtPath,
} from '../src/forms/types'

interface FormValues {
  account: {
    name: string
    type: 'business' | 'personal'
  }
  contacts: Array<{
    email: string
  }>
  notes: string
}

class FormValueSource {
  declare account: FormValues['account']
  declare contacts: FormValues['contacts']
  declare notes: string
}

function initialValues(): FormValues {
  return {
    account: { name: 'Ada', type: 'personal' },
    contacts: [{ email: 'ada@example.com' }],
    notes: 'unchanged',
  }
}

function deferred<TValue>(): {
  readonly promise: Promise<TValue>
  resolve(value: TValue): void
  reject(reason: unknown): void
} {
  let resolvePromise: (value: TValue) => void = () => undefined
  let rejectPromise: (reason: unknown) => void = () => undefined
  const promise = new Promise<TValue>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('P4-A form state engine', () => {
  it('updates nested values immutably and preserves unaffected identities', () => {
    const store = new FormStore(initialValues())
    const listener = vi.fn()
    store.subscribe(listener)
    const initialState = store.state
    const initialContacts = initialState.values.contacts

    const changed = store.set('account.name', 'Grace', { touch: true })

    expect(changed).not.toBe(initialState)
    expect(changed.values).not.toBe(initialState.values)
    expect(changed.values.account).not.toBe(initialState.values.account)
    expect(changed.values.contacts).toBe(initialContacts)
    expect(changed.initialValues).toBe(initialState.initialValues)
    expect(changed.dirtyPaths).toEqual(['account.name'])
    expect(changed.touchedPaths).toEqual(['account.name'])
    expect(Object.isFrozen(changed.values)).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    expect(store.set('account.name', 'Grace')).toBe(changed)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('supports nested arrays and repeater insert, move, remove, field reset, and full reset', () => {
    const store = new FormStore(initialValues())
    store.insert('contacts', 1, { email: 'grace@example.com' })
    expect(store.get('contacts.1.email')).toBe('grace@example.com')

    store.move('contacts', 1, 0)
    expect(store.get('contacts.0.email')).toBe('grace@example.com')
    store.set('contacts.0.email', 'new@example.com', { touch: true })
    expect(store.state.dirtyPaths).toContain('contacts.0.email')

    store.resetField('contacts.0.email')
    expect(store.get('contacts.0.email')).toBe('ada@example.com')
    expect(store.state.touchedPaths).not.toContain('contacts.0.email')

    store.remove('contacts', 1)
    store.set('account.name', 'Changed')
    const reset = store.reset()
    expect(reset.values).toBe(reset.initialValues)
    expect(reset.values).toEqual(initialValues())
    expect(reset.dirtyPaths).toEqual([])
    expect(reset.touchedPaths).toEqual([])
  })

  it('moves repeater field metadata with item identity across index changes', () => {
    const store = new FormStore(initialValues())
    store.batch([
      { kind: 'touch', path: 'contacts.0.email' },
      { kind: 'errors', path: 'contacts.0.email', errors: ['Invalid'] },
      { kind: 'pending', path: 'contacts.0.email', value: true },
    ])

    store.insert('contacts', 0, { email: 'new@example.com' })
    expect(store.state.touchedPaths).toEqual(['contacts.1.email'])
    expect(store.state.errors['contacts.1.email']).toEqual(['Invalid'])
    expect(store.state.pending['contacts.1.email']).toBe(true)

    store.move('contacts', 1, 0)
    expect(store.state.touchedPaths).toEqual(['contacts.0.email'])
    expect(store.state.errors['contacts.0.email']).toEqual(['Invalid'])

    store.remove('contacts', 0)
    expect(store.state.touchedPaths).toEqual([])
    expect(store.state.errors).toEqual({})
    expect(store.state.pending).toEqual({})
  })

  it('batches operations and recomputes each affected conditional dependency once', () => {
    const recompute = vi.fn(({ get }: { get(path: 'account.type'): FormValues['account']['type'] }) => [{
      kind: 'visible' as const,
      path: 'account.name',
      value: get('account.type') === 'business',
    }])
    const store = new FormStore(initialValues(), {
      dependencies: [{ id: 'business-name', paths: ['account.type'], recompute }],
    })
    const listener = vi.fn()
    store.subscribe(listener)

    store.batch([
      { kind: 'set', path: 'account.type', value: 'business' },
      { kind: 'set', path: 'account.type', value: 'personal' },
      { kind: 'set', path: 'account.type', value: 'business' },
      { kind: 'disabled', path: 'account.name', value: true },
      { kind: 'read-only', path: 'notes', value: true },
      { kind: 'pending', path: 'account.name', value: true },
    ])

    expect(recompute).toHaveBeenCalledTimes(1)
    expect(store.state.visibility['account.name']).toBe(true)
    expect(store.state.disabled['account.name']).toBe(true)
    expect(store.state.readOnly.notes).toBe(true)
    expect(store.state.pending['account.name']).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rolls back an entire atomic batch when dependency recomputation fails', () => {
    const store = new FormStore(initialValues(), {
      dependencies: [{
        id: 'failure',
        paths: ['account.name'],
        recompute: () => {
          throw new Error('dependency failed')
        },
      }],
    })
    const before = store.state

    expect(() => store.set('account.name', 'Nope')).toThrow('dependency failed')
    expect(store.state).toBe(before)
    expect(store.get('account.name')).toBe('Ada')
  })

  it('preserves a dependency target after the user edits it directly', () => {
    const store = new FormStore({ slug: '', title: '' }, {
      dependencies: [{
        id: 'title-to-slug',
        paths: ['title'],
        recompute: context => context.touchedPaths.has('slug')
          ? []
          : [{ kind: 'set', path: 'slug', value: String(context.get('title')).toLowerCase().replaceAll(' ', '-') }],
      }],
    })

    store.set('title', 'First Title', { touch: true })
    expect(store.get('slug')).toBe('first-title')

    store.set('slug', 'editorial-slug', { touch: true })
    store.set('title', 'Second Title', { touch: true })

    expect(store.get('slug')).toBe('editorial-slug')
  })

  it('applies server validation errors atomically and exposes first-error focus metadata', async () => {
    const components = schemaComponentsFor(FormValueSource)
    const schema = defineSchema('form', FormValueSource).components([
      components.custom('app:input').key('name').statePath('account.name'),
      components.custom('app:input').key('email').statePath('contacts.email'),
    ]).compile()
    const store = new FormStore(initialValues(), { schema })
    const listener = vi.fn()
    store.subscribe(listener)

    const result = await store.validateRequest(async context => ({
      errors: {
        'contacts.0.email': ['Invalid email'],
        'account.name': 'Required',
      },
      operations: [{ kind: 'visible', path: 'account.name', value: true }],
      focusFirstError: true,
    }))

    expect(result.status).toBe('applied')
    expect(store.state.validating).toBe(false)
    expect(store.state.errors).toEqual({
      'contacts.0.email': ['Invalid email'],
      'account.name': ['Required'],
    })
    expect(store.state.focus).toEqual({
      path: 'account.name',
      componentId: 'form.name',
      requestVersion: result.version,
    })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('aborts superseded validation and ignores stale responses', async () => {
    const first = deferred<{ errors: { notes: string } }>()
    const second = deferred<{ errors: { notes: string } }>()
    const contexts: Array<FormRequestContext<FormValues>> = []
    const store = new FormStore(initialValues())
    const request = (response: ReturnType<typeof deferred<{ errors: { notes: string } }>>) => store.validateRequest(async context => {
      contexts.push(context)
      return response.promise
    })

    const firstRequest = request(first)
    const secondRequest = request(second)
    expect(contexts[0]?.signal.aborted).toBe(true)
    expect(contexts[1]?.version).toBeGreaterThan(contexts[0]?.version ?? 0)

    second.resolve({ errors: { notes: 'Newest' } })
    expect((await secondRequest).status).toBe('applied')
    first.resolve({ errors: { notes: 'Stale' } })
    expect((await firstRequest).status).toBe('stale')
    expect(store.state.errors.notes).toEqual(['Newest'])
    expect(store.state.validating).toBe(false)
  })

  it('tracks submit pending state, cancellation, commits values, and versioned server patches', async () => {
    const store = new FormStore(initialValues())
    store.set('notes', 'submitted')
    const pending = deferred<{ commitValues: true }>()
    const submission = store.submit(async () => pending.promise)
    expect(store.state.submitting).toBe(true)
    store.cancelRequests('submit')
    expect(store.state.submitting).toBe(false)
    pending.resolve({ commitValues: true })

    expect((await submission).status).toBe('aborted')
    expect(store.state.submitting).toBe(false)

    const successful = await store.submit(async () => ({ commitValues: true }))
    expect(successful.status).toBe('applied')
    expect(store.state.initialValues.notes).toBe('submitted')
    expect(store.state.dirtyPaths).toEqual([])

    expect(store.applyServerPatch({ operations: [{ kind: 'set', path: 'notes', value: 'version-two' }] }, 2)).toBe(true)
    const afterVersionTwo = store.state
    expect(store.applyServerPatch({ operations: [{ kind: 'set', path: 'notes', value: 'stale' }] }, 1)).toBe(false)
    expect(store.state).toBe(afterVersionTwo)
    expect(store.get('notes')).toBe('version-two')
  })

  it('clears field errors on edits and reset transitions', async () => {
    const store = new FormStore(initialValues())
    store.applyServerPatch({
      errors: { 'account.name': 'Invalid', notes: 'Too long' },
      focusFirstError: true,
    })
    store.touch('account.name')

    store.set('account.name', 'Valid')
    expect(store.state.errors['account.name']).toBeUndefined()
    expect(store.state.errors.notes).toEqual(['Too long'])

    store.reset()
    expect(store.state.errors).toEqual({})
    expect(store.state.focus).toBeUndefined()
    expect(store.state.touchedPaths).toEqual([])
  })

  it('provides precise nested path and state types', () => {
    expectTypeOf<FormPath<FormValues>>().toEqualTypeOf<
      | 'account'
      | 'account.name'
      | 'account.type'
      | 'contacts'
      | `contacts.${number}`
      | `contacts.${number}.email`
      | 'notes'
    >()
    expectTypeOf<FormValueAtPath<FormValues, 'contacts.0.email'>>().toEqualTypeOf<string>()
    expectTypeOf(new FormStore(initialValues()).state).toEqualTypeOf<FormState<FormValues>>()
  })
})
