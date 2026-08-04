import { describe, expect, it, vi } from 'vitest'
import { EntryRendererRegistry } from '../src/entries/registry'
import {
  copyableEntryText,
  entryRichTextMetadata,
  entryUsesMarkdown,
  safeEntryAttributes,
  safeExternalUrl,
  safeMarkdownBlocks,
} from '../src/entries/safety'
import { EntryStateStore } from '../src/entries/store'

const manifest = {
  actions: ['view-post'],
  copyable: true,
  defaultValue: 'Unknown',
  extraAttributes: {},
  formatters: [{ kind: 'prefix', value: '# ' }],
  inlineLabel: true,
  label: 'Title',
  layout: {},
  path: 'title',
  placeholder: 'Missing',
  properties: { formats: [] },
  slots: {},
  type: 'text',
  visible: true,
} as const

describe('P8-A client entry state', () => {
  it('hydrates state and notifies framework stores', async () => {
    const store = new EntryStateStore('post-title', manifest)
    const listener = vi.fn()
    store.subscribe(listener)
    await store.hydrate(async () => ({ state: 'Hello', tooltip: 'Copy title', url: '/posts/1' }))
    expect(store.snapshot).toMatchObject({
      formattedState: '# Hello',
      pending: false,
      state: 'Hello',
      tooltip: 'Copy title',
      url: '/posts/1',
    })
    expect(listener).toHaveBeenCalled()
  })

  it('preserves explicit null hydration and ignores stale completions', async () => {
    const store = new EntryStateStore('post-title', manifest)
    let finishFirst: ((value: { readonly state: string }) => void) | undefined
    let firstSignal: AbortSignal | undefined
    const first = store.hydrate(signal => {
      firstSignal = signal
      return new Promise(resolve => {
        finishFirst = resolve
      })
    })
    await store.hydrate(() => ({ state: null, tooltip: null, url: null }))
    expect(firstSignal?.aborted).toBe(true)
    expect(store.snapshot).toMatchObject({ state: null, tooltip: null, url: null })
    finishFirst?.({ state: 'Stale' })
    await first
    expect(store.snapshot.state).toBeNull()
  })

  it('contains resolver failures without leaking non-error values', async () => {
    const store = new EntryStateStore('post-title', manifest)
    await store.hydrate(() => {
      throw { secret: 'database-password' }
    })
    expect(store.snapshot.error).toBe('Unable to resolve entry state.')
    expect(store.snapshot.pending).toBe(false)
    expect(JSON.stringify(store.snapshot)).not.toContain('database-password')
  })

  it('allow-lists actions before invoking handlers', async () => {
    const store = new EntryStateStore('post-title', manifest)
    const handler = vi.fn()
    await store.invokeAction('view-post', handler)
    expect(handler).toHaveBeenCalledWith('view-post', store.snapshot)
    await expect(store.invokeAction('delete-post', handler)).rejects.toThrow('not allowed')
  })

  it('registers built-in and generated custom renderers with collision diagnostics', () => {
    const registry = new EntryRendererRegistry<string>()
    registry.register({ source: 'panels', type: 'text' }, 'TextEntry')
    registry.register({ source: 'acme-plugin', type: 'acme:entry:rating' }, 'RatingEntry')
    expect(registry.resolve('acme:entry:rating')).toBe('RatingEntry')
    expect(() => registry.register({ source: 'other', type: 'text' }, 'OtherText')).toThrow('conflicts with panels')
    expect(() => registry.resolve('missing')).toThrow('requested from compiled infolist')
  })

  it('normalizes safe links and copy text', () => {
    expect(safeExternalUrl('/posts/1')).toBe('/posts/1')
    expect(safeExternalUrl('https://example.com/post')).toBe('https://example.com/post')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('\\\\evil.example/path')).toBeNull()
    expect(safeExternalUrl('/\\evil.example/path')).toBeNull()
    expect(safeExternalUrl('\u0000javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('//evil.example/path')).toBeNull()
    expect(safeExternalUrl('https://user:secret@example.com')).toBeNull()
    expect(copyableEntryText({ safe: '<script>' })).toBe('{"safe":"<script>"}')
  })

  it('retains presentation metadata and produces structure without executable markup', () => {
    const store = new EntryStateStore('post-title', {
      ...manifest,
      defaultValue: '**Safe** <script>alert(1)</script> [bad](javascript:evil)',
      extraAttributes: { 'data-entry-kind': 'summary', onclick: 'steal()', title: 'Summary' },
      layout: { columnSpan: { default: 2 }, order: { lg: 1 } },
      properties: {
        formats: [
          { kind: 'markdown', rawHtml: false, value: true },
          { kind: 'rich-text', sanitizer: 'content.safe', structured: true },
        ],
      },
      slots: {
        before: [{ component: 'entry-prefix', order: -1, properties: {}, source: 'component' }],
      },
      visible: false,
    })

    expect(store.snapshot).toMatchObject({
      extraAttributes: { 'data-entry-kind': 'summary', onclick: 'steal()', title: 'Summary' },
      layout: { columnSpan: { default: 2 }, order: { lg: 1 } },
      visible: false,
    })
    expect(store.snapshot.slots?.before?.[0]?.component).toBe('entry-prefix')
    expect(entryUsesMarkdown(store.snapshot.properties)).toBe(true)
    expect(entryRichTextMetadata(store.snapshot.properties)).toEqual({ sanitizer: 'content.safe', structured: true })
    expect(safeMarkdownBlocks(store.snapshot.state)[0]?.segments).toEqual([
      { kind: 'strong', value: 'Safe' },
      { kind: 'text', value: ' <script>alert(1)</script> bad' },
    ])
    expect(safeEntryAttributes(store.snapshot.extraAttributes)).toEqual({ 'data-entry-kind': 'summary', title: 'Summary' })
  })
})
