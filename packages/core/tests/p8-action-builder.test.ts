import { describe, expect, expectTypeOf, it } from 'vitest'
import { createResourceActionComposer, defineAction } from '../src/actions/builder'
import type { JsonObject } from '../src/protocol/json'

interface Post {
  readonly id: number
  readonly published: boolean
  readonly title: string
}

interface PublishInput extends JsonObject {
  readonly published: boolean
}

interface Actor {
  readonly id: number
  readonly role: 'admin' | 'editor'
}

interface Tenant {
  readonly id: number
}

interface Services {
  readonly audit: (message: string) => Promise<void>
}

describe('fluent action authoring', () => {
  it('infers standalone action contexts from runtime sources', () => {
    class StandaloneActor {
      readonly id = 1
      readonly role = 'admin' as const
    }
    class StandaloneTenant {
      readonly id = 2
    }
    class StandaloneServices {
      readonly audit = async (_message: string): Promise<void> => undefined
    }
    const PostSource = { create: () => ({ id: 1, published: false, title: 'Post' }) }
    const PublishInputSource = { create: () => ({ published: true }) }
    const action = defineAction('publish', {
      actor: StandaloneActor,
      input: PublishInputSource,
      record: PostSource,
      services: StandaloneServices,
      tenant: StandaloneTenant,
    })
      .authorize(context => {
        expectTypeOf(context.actor).toEqualTypeOf<StandaloneActor>()
        expectTypeOf(context.record?.title).toEqualTypeOf<string | undefined>()
        expectTypeOf(context.services).toEqualTypeOf<StandaloneServices>()
        expectTypeOf(context.tenant).toEqualTypeOf<StandaloneTenant>()
        return context.actor.role === 'admin'
      })
      .action((input) => {
        expectTypeOf(input.published).toEqualTypeOf<boolean>()
        return input.published
      })
      .compile()

    expect(action.id).toBe('publish')
  })

  it('infers resource action callbacks and compiles server behavior', async () => {
    const actions = createResourceActionComposer<Post, PublishInput, Actor, Tenant, Services>()
    const actionBuilder = actions.action('publish')
      .label(context => `${context.record?.title ?? 'Post'} publish`)
      .authorize(context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        expectTypeOf(context.record).toEqualTypeOf<Post | null>()
        expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
        expectTypeOf(context.services).toEqualTypeOf<Services>()
        return context.actor.role === 'admin'
      })
      .action(async (input, context) => {
        expectTypeOf(input).toEqualTypeOf<PublishInput>()
        await context.services.audit(`publish:${context.record?.id ?? 'new'}`)
        return { published: input.published }
      })
      .successNotification((result) => ({
        actions: [],
        body: result.published ? 'Published' : 'Unpublished',
        closeable: true,
        color: null,
        duration: null,
        icon: null,
        id: 'post-published',
        persistent: false,
        status: 'success',
        title: 'Post updated',
      }))
      .transactional()
    const action = actionBuilder.compile()

    const audit: string[] = []
    const result = await action.handle({ published: true }, {
      actor: { id: 1, role: 'admin' },
      mount: 'record',
      record: { id: 2, published: false, title: 'Release' },
      services: { audit: async message => { audit.push(message) } },
      signal: new AbortController().signal,
      tenant: { id: 3 },
    })

    expect(result).toEqual({ published: true })
    expect(audit).toEqual(['publish:2'])
    expect(action).toMatchObject({ id: 'publish', kind: 'custom', label: expect.any(Function), mount: 'record', transactional: true })
    expect(Object.isFrozen(action)).toBe(true)
    expect(() => actionBuilder.label('Changed')).toThrow()
  })

  it('requires explicit server authorization and a handler', () => {
    const actions = createResourceActionComposer<Post, PublishInput, Actor, Tenant, Services>()
    expect(() => actions.action('publish').action(async () => true).compile()).toThrow('requires authorization')
    expect(() => actions.action('publish').authorize(() => true).compile()).toThrow('requires a handler')
  })
})
