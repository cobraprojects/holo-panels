import { Window } from 'happy-dom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TableAcceptanceFixture } from '../src/table-acceptance/contracts'
import { runTableAcceptanceJourney } from '../src/table-acceptance/journey'

const browser = new Window({ url: 'http://localhost/' })
let fixtures: readonly [string, TableAcceptanceFixture][] = []

beforeAll(async () => {
  const exposed = {
    Comment: browser.Comment,
    DOMParser: browser.DOMParser,
    Document: browser.Document,
    DocumentFragment: browser.DocumentFragment,
    Element: browser.Element,
    Event: browser.Event,
    HTMLElement: browser.HTMLElement,
    HTMLInputElement: browser.HTMLInputElement,
    HTMLMediaElement: browser.HTMLMediaElement,
    HTMLSelectElement: browser.HTMLSelectElement,
    KeyboardEvent: browser.KeyboardEvent,
    MouseEvent: browser.MouseEvent,
    MutationObserver: browser.MutationObserver,
    Node: browser.Node,
    SVGElement: browser.SVGElement,
    ShadowRoot: browser.ShadowRoot,
    Text: browser.Text,
    document: browser.document,
    getComputedStyle: browser.getComputedStyle.bind(browser),
    navigator: browser.navigator,
    requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
    window: browser,
  }
  for (const [key, value] of Object.entries(exposed)) Reflect.set(globalThis, key, value)
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const [next, nuxt, svelteKit] = await Promise.all([
    import('../../../apps/example-next/tests/p7-table-acceptance-next'),
    import('../../../apps/example-nuxt/tests/p7-table-acceptance-nuxt'),
    import('../../../apps/example-sveltekit/tests/p7-table-acceptance-sveltekit'),
  ])
  fixtures = [
    ['Next', next.nextTableAcceptanceFixture],
    ['Nuxt', nuxt.nuxtTableAcceptanceFixture],
    ['SvelteKit', svelteKit.svelteKitTableAcceptanceFixture],
  ]
})

afterAll(async () => browser.close())

describe('P7 table phase-gate acceptance', () => {
  it('runs the identical observable table journey through every example renderer', async () => {
    expect(fixtures).toHaveLength(3)
    for (const [name, fixture] of fixtures) {
      const report = await runTableAcceptanceJourney(fixture)

      expect(report.framework, name).toBe(fixture.framework)
      expect(report.render.ssrStable, name).toBe(true)
      expect(report.render.markup, name).toContain('<table')
      expect(report.render.markup, name).toContain('<caption')
      expect(report.render.markup, name).toContain('Posts')
      expect(report.render.markup, name).toContain('role="region"')
      expect(report.render.markup, name).toContain('tabindex="0"')
      expect(report.render.markup, name).toContain('aria-sort="none"')
      expect(report.render.markup, name).toContain('Omar')
      expect(report.render.markup, name).toContain('Draft count')
      expect(report.render.markup, name).toContain('Total posts')
      expect(report.search, name).toBe('nile')
      expect(report.filter, name).toBe(20)
      expect(report.sort, name).toEqual([{ column: 'title', direction: 'asc' }])
      expect(report.columnVisibility, name).toEqual(['author.name', 'title'])
      expect(report.page, name).toBe(2)
      expect(report.selectionMode, name).toBe('all-matching')
      expect(report.markupAfterSelection, name).toContain('All 6 matching records selected')
      expect(report.actionRequests, name).toEqual([expect.objectContaining({
        actionId: 'posts.publish',
        selection: expect.objectContaining({ excludedRecordIds: [], mode: 'all-matching' }),
      })])
      expect(report.inlineEditRequests, name).toEqual([{
        action: 'posts.rename',
        columnPath: 'title',
        expectedVersion: 'v1',
        recordId: 1,
        value: 'Renamed from acceptance',
      }])
      expect(report.collapsedGroupRows, name).toBe(0)
      expect(browser.document.body.childElementCount, name).toBe(0)
    }
  })
})
