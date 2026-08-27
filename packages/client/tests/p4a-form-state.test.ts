import { defineSchema, schemaComponentsFor } from '@holo-js/panels-core'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { FormStore } from '../src/forms/store'
import { formValidationFailure } from '../src/forms/validation'
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
        recompute: context => context.editedPaths.has('slug')
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

  it('keeps hydrated and blurred slugs automatic until a direct edit, including after reset', () => {
    const store = new FormStore({ slug: 'original-title', title: 'Original title' }, {
      dependencies: [{
        id: 'title-to-slug',
        paths: ['title'],
        recompute: context => context.editedPaths.has('slug')
          ? []
          : [{ kind: 'set', path: 'slug', value: context.get('title').toLowerCase().replaceAll(' ', '-') }],
      }],
    })

    store.touch('slug')
    store.set('title', 'Updated title', { touch: true })
    expect(store.get('slug')).toBe('updated-title')
    store.set('slug', 'custom', { touch: true })
    store.set('slug', 'original-title', { touch: true })
    store.set('title', 'Another title', { touch: true })
    expect(store.get('slug')).toBe('original-title')
    store.reset()
    store.set('title', 'Reset title', { touch: true })
    expect(store.get('slug')).toBe('reset-title')
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

  it('preserves server errors until validation or reset clears them', async () => {
    const store = new FormStore(initialValues())
    store.applyServerPatch({
      errors: { 'account.name': 'Invalid', notes: 'Too long' },
      focusFirstError: true,
    })
    store.touch('account.name')

    store.set('account.name', 'Valid')
    expect(store.state.errors['account.name']).toEqual(['Invalid'])
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

  it('validates on submit and revalidates only invalid fields while they are corrected', async () => {
    const store = new FormStore({ email: '', title: '' }, { fields: [
      { path: 'email', type: 'text', required: true, properties: { inputMode: 'email' } },
      { path: 'title', type: 'text', required: true },
    ] })
    const submit = vi.fn(async () => ({ commitValues: true }))
    store.set('email', 'incorrect')
    expect(store.state.errors).toEqual({})
    expect((await store.submit(submit)).status).toBe('invalid')
    expect(submit).not.toHaveBeenCalled()
    expect(store.errorBag.get('email').length).toBeGreaterThan(0)
    store.set('email', 'still-incorrect')
    await vi.waitFor(() => expect(store.state.errors.email?.length).toBeGreaterThan(0))
    store.set('email', 'editor@example.com')
    expect(store.state.errors.title?.length).toBeGreaterThan(0)
    store.set('title', 'Saved title')
    await vi.waitFor(() => expect(store.state.errors).toEqual({}))
    expect((await store.submit(submit)).status).toBe('applied')
    expect(store.state.dirtyPaths).toEqual([])
  })

  it('preserves entered values and separates server field errors from form errors and transport failures', async () => {
    const store = new FormStore({ title: 'Entered value' })
    const outcome = await store.submit(async () => {
      throw formValidationFailure({ title: ['Already used'], _root: ['The submission needs review'] })
    })
    expect(outcome.status).toBe('invalid')
    expect(store.state.values.title).toBe('Entered value')
    expect(store.errorBag.get('title')).toEqual(['Already used'])
    expect(store.state.errors._root).toEqual(['The submission needs review'])
    await expect(store.submit(async () => { throw new Error('Network unavailable') })).rejects.toThrow('Network unavailable')
    expect(store.state.submitting).toBe(false)
    expect(store.state.values.title).toBe('Entered value')
    expect((await store.submit(async () => { throw formValidationFailure({}) })).status).toBe('invalid')
    expect(store.state.errors._root).toEqual(['The submitted data is invalid.'])
  })

  it('submits collection and typed choice values while retaining bound Holo constraints', async () => {
    const store = new FormStore({ tags: ['a'], choice: 1, enabled: true as boolean | null }, { fields: [
      { path: 'tags', type: 'tags', required: true },
      { path: 'choice', type: 'toggle-buttons', properties: { validationHints: { kind: 'number', required: true, nullable: false, allowedValues: [1, 2] } } },
      { path: 'enabled', type: 'radio', clientHints: { kind: 'boolean', required: false, nullable: true } },
    ] })
    const submit = vi.fn(async () => ({ commitValues: true }))
    expect((await store.submit(submit)).status).toBe('applied')
    store.set('enabled', null)
    expect((await store.submit(submit)).status).toBe('applied')
    store.set('choice', 3)
    expect((await store.submit(submit)).status).toBe('invalid')
    expect(store.state.errors.choice?.length).toBeGreaterThan(0)
    store.set('choice', 2)
    await vi.waitFor(() => expect(store.state.errors.choice).toBeUndefined())
    store.set('tags', [])
    expect((await store.submit(submit)).status).toBe('invalid')
    expect(store.state.errors.tags?.length).toBeGreaterThan(0)
  })

  it('uses current visibility and editability when validating a conditional form', async () => {
    const store = new FormStore({ title: '', slug: '', notes: '' }, { fields: [
      { path: 'title', type: 'text', required: true },
      { path: 'slug', type: 'text', required: true },
      { path: 'notes', type: 'text', required: true },
    ] })
    store.batch([
      { kind: 'visible', path: 'title', value: false },
      { kind: 'disabled', path: 'slug', value: true },
      { kind: 'read-only', path: 'notes', value: true },
    ])
    const submit = vi.fn(async () => ({ commitValues: true }))
    expect((await store.submit(submit)).status).toBe('applied')
    expect(submit).toHaveBeenCalledOnce()
    store.batch([{ kind: 'visible', path: 'title', value: true }])
    expect((await store.submit(submit)).status).toBe('invalid')
    expect(store.state.errors.title?.length).toBeGreaterThan(0)
  })

  it('keeps edits made during a save dirty against the values actually submitted', async () => {
    const store = new FormStore({ title: 'Initial' })
    store.set('title', 'Submitted')
    const pending = deferred<{ commitValues: true }>()
    const submit = vi.fn(async () => pending.promise)
    const request = store.submit(submit)
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    store.set('title', 'Edited while saving')
    pending.resolve({ commitValues: true })
    await request
    expect(store.state.values.title).toBe('Edited while saving')
    expect(store.state.initialValues.title).toBe('Submitted')
    expect(store.state.dirtyPaths).toEqual(['title'])
  })
})
