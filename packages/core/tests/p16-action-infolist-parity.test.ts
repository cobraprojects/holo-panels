import { describe, expect, it, vi } from 'vitest'
import { compileActionManifest } from '../src/actions/action'
import type { ActionContext, ActionDefinition } from '../src/actions/contracts'
import { ActionEngine } from '../src/actions/engine'
import { actionGroup } from '../src/actions/groups'
import { entriesFor, formatEntryState } from '../src/infolists/entries'
import type { JsonObject } from '../src/protocol/json'

class PostRecord {
  declare readonly body: string
  declare readonly id: number
  declare readonly title: string
}

interface Services {
  readonly events: string[]
}

const signal = new AbortController().signal
const actionContext: ActionContext<PostRecord, string, string, Services> = {
  actor: 'admin',
  mount: 'page',
  record: null,
  services: { events: [] },
  signal,
  tenant: 'tenant-a',
}

function action(overrides: Partial<ActionDefinition<PostRecord, JsonObject, string, string, string, Services>> = {}): ActionDefinition<PostRecord, JsonObject, string, string, string, Services> {
  return {
    authorize: () => true,
    handle: () => 'complete',
    id: 'posts.publish',
    kind: 'custom',
    label: 'Publish',
    mount: 'page',
    ...overrides,
  }
}

describe('P16 action and infolist parity', () => {
  it('compiles responsive entry presentation and keeps visibility resolvers server-only', () => {
    const definition = entriesFor(PostRecord).text('title')
      .visible(({ record }) => record.id > 0)
      .columnSpan({ default: 'full', md: 2 })
      .columnStart(1)
      .extraAttributes({ 'data-entry': 'title' })
      .before({ component: 'acme.prefix', order: -1, properties: { compact: true } })
      .after('acme.suffix')
      .compile()

    expect(definition.manifest).toMatchObject({
      dynamicVisibility: true,
      extraAttributes: { 'data-entry': 'title' },
      layout: { columnSpan: { default: 'full', md: 2 }, columnStart: { default: 1 } },
      slots: {
        after: [{ component: 'acme.suffix' }],
        before: [{ component: 'acme.prefix', order: -1, properties: { compact: true } }],
      },
      visible: true,
    })
    expect(definition.server.visibility).toBeTypeOf('function')
    expect(JSON.stringify(definition.manifest)).not.toContain('record')
  })

  it('marks markdown as raw-HTML-disabled and rich text as sanitizer-bound structured content', () => {
    const markdown = entriesFor(PostRecord).text('body').markdown().compile()
    const richText = entriesFor(PostRecord).text('body').richText('structural').compile()

    expect(markdown.manifest.properties.formats).toContainEqual({ kind: 'markdown', rawHtml: false, value: true })
    expect(formatEntryState('<img src=x onerror=alert(1)>', markdown.manifest.formatters)).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(formatEntryState('<strong>plain</strong>', entriesFor(PostRecord).text('body').markdown(false).compile().manifest.formatters)).toBe('<strong>plain</strong>')
    expect(richText.manifest.properties.formats).toContainEqual({ kind: 'rich-text', sanitizer: 'structural', structured: true })
    expect(() => entriesFor(PostRecord).text('body').richText('unsafe sanitizer')).toThrow('stable identifier')
  })

  it('resolves complete action presentation and modal manifests without callbacks', async () => {
    const manifest = await compileActionManifest(action({
      badge: ({ tenant }) => tenant,
      color: 'success',
      icon: 'check',
      modal: {
        content: { component: 'acme.summary' },
        description: ({ actor }) => `Confirm for ${actor}`,
        footer: { component: 'acme.footer', order: 10 },
        heading: 'Publish post',
        nestedActions: ['posts.preview', 'posts.schedule'],
        slideOver: true,
        width: 'screen',
      },
      size: 'large',
      tooltip: 'Publish now',
    }), 'Publish', actionContext)

    expect(manifest).toMatchObject({
      badge: 'tenant-a',
      color: 'success',
      icon: 'check',
      modal: {
        description: 'Confirm for admin',
        heading: 'Publish post',
        nestedActions: ['posts.preview', 'posts.schedule'],
        slideOver: true,
        width: 'screen',
      },
      size: 'large',
      tooltip: 'Publish now',
      type: 'custom',
    })
    expect(JSON.stringify(manifest)).not.toContain('=>')
  })

  it('compiles immutable groups that reference unique stable action IDs', () => {
    const group = actionGroup('publishing', { id: 'posts.publish' }, { id: 'posts.schedule' })
      .label('Publishing')
      .icon('paper-airplane')
      .color('primary')
      .compile()

    expect(group).toEqual({
      actions: ['posts.publish', 'posts.schedule'],
      color: 'primary',
      icon: 'paper-airplane',
      id: 'publishing',
      label: 'Publishing',
    })
    expect(Object.isFrozen(group)).toBe(true)
    expect(() => actionGroup('publishing', { id: 'posts.publish' }, { id: 'posts.publish' })).toThrow('unique')
  })

  it('rate-limits after authorization and before transaction and lifecycle execution', async () => {
    const events: string[] = []
    const authorize = vi.fn(() => { events.push('authorize'); return true })
    const rateLimitKey = vi.fn(() => { events.push('rate-limit'); return 'admin:tenant-a' })
    const transactionStarted = vi.fn()
    const engine = new ActionEngine<PostRecord, number, string, string, Services>({
      records: { resolve: async () => null, version: () => null },
      transaction: {
        async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
          transactionStarted()
          events.push('transaction')
          return operation()
        },
      },
    })
    const definition = action({
      authorize,
      handle: () => { events.push('handle'); return 'complete' },
      lifecycle: {
        after: () => { events.push('after') },
        before: () => { events.push('before') },
      },
      rateLimit: { key: rateLimitKey, limit: 1, windowMilliseconds: 60_000 },
    })

    await engine.execute(definition, { idempotencyKey: 'first', input: {}, mount: 'page' }, { ...actionContext, services: { events } })
    await expect(engine.execute(definition, { idempotencyKey: 'second', input: {}, mount: 'page' }, { ...actionContext, services: { events } }))
      .rejects.toMatchObject({ code: 'rate-limited' })
    expect(events).toEqual(['authorize', 'rate-limit', 'transaction', 'before', 'handle', 'after', 'authorize', 'rate-limit'])
    expect(transactionStarted).toHaveBeenCalledOnce()
  })
})
