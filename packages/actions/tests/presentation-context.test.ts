import { ActionEngine, compileActionManifest, resolveActionState } from '@holo-js/panels-core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createActionFactory } from '../src'

describe('action presentation context', () => {
  it.each([false, () => false])('preserves disabled visibility for literals and callbacks', async (visible) => {
    const definition = createActionFactory().CreateAction.make().visible(visible).compile()
    const state = await resolveActionState(definition, {
      actor: {},
      mount: 'page',
      record: null,
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    })
    expect(state.visible).toBe(false)
  })

  it('renders list-page actions before input, with partial input, and executes with submitted input', async () => {
    type Values = { title: string, category: string }
    const definition = createActionFactory<{ id: number }, Values>().CreateAction.make()
      .label(({ data, record }) => {
        expectTypeOf(data).toEqualTypeOf<Readonly<Partial<Values>> | undefined>()
        expect(record).toBeNull()
        return data?.title ? `Create ${data.title}` : 'Create post'
      })
      .modalHeading(({ data }) => data?.title ?? 'New post')
      .authorize(({ data }) => {
        expectTypeOf(data).toEqualTypeOf<Readonly<Values>>()
        return data.category === 'news'
      })
      .action((data, context) => {
        expectTypeOf(data).toEqualTypeOf<Readonly<Values>>()
        expectTypeOf(context.data).toEqualTypeOf<Readonly<Values>>()
        return { title: context.data.title, category: data.category }
      })
      .compile()
    const context = {
      actor: {},
      mount: 'page' as const,
      record: null,
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    }

    const initial = await resolveActionState(definition, context)
    expect(initial.label).toBe('Create post')
    const editingContext = { ...context, data: { title: 'Release notes' } }
    const editing = await resolveActionState(definition, editingContext)
    expect(editing.label).toBe('Create Release notes')
    expect(await compileActionManifest(definition, editing.label, editingContext, editing)).toMatchObject({
      label: 'Create Release notes',
      modal: { heading: 'Release notes' },
    })

    const engine = new ActionEngine<{ id: number }, number, object, unknown, object>({
      records: { resolve: async () => null, version: () => null },
      transaction: { run: operation => operation() },
    })
    expect(await engine.execute(definition, {
      idempotencyKey: 'create-release',
      input: { title: 'Release notes', category: 'news' },
      mount: 'page',
    }, context)).toMatchObject({ result: { title: 'Release notes', category: 'news' }, status: 'succeeded' })
  })
})
