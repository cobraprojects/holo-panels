import { Window } from 'happy-dom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TableAcceptanceFixture } from '../src/table-acceptance/contracts'
import { runTableAcceptanceJourney } from '../src/table-acceptance/journey'
import { paginationRange as reactPaginationRange } from '../../react/src/tables/helpers'
import { paginationRange as sveltePaginationRange } from '../../svelte/src/tables/helpers'
import { paginationRange as vuePaginationRange } from '../../vue/src/tables/helpers'
import { loadExampleExport } from './load-example'

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
    loadExampleExport<TableAcceptanceFixture>('next', 'p7-table-acceptance-next', 'nextTableAcceptanceFixture'),
    loadExampleExport<TableAcceptanceFixture>('nuxt', 'p7-table-acceptance-nuxt', 'nuxtTableAcceptanceFixture'),
    loadExampleExport<TableAcceptanceFixture>('sveltekit', 'p7-table-acceptance-sveltekit', 'svelteKitTableAcceptanceFixture'),
  ])
  fixtures = [
    ['Next', next],
    ['Nuxt', nuxt],
    ['SvelteKit', svelteKit],
  ]
})

afterAll(async () => browser.close())

describe('P7 table phase-gate acceptance', () => {
  it('keeps one deterministic pagination range contract across renderers', () => {
    const cases = [
      { current: 1, expected: [1], total: 1 },
      { current: 3, expected: [1, 2, 3, 4, 5, 6, 7], total: 7 },
      { current: 1, expected: [1, 2, 3, 4, 5, 'ellipsis', 10], total: 10 },
      { current: 4, expected: [1, 2, 3, 4, 5, 'ellipsis', 10], total: 10 },
      { current: 5, expected: [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10], total: 10 },
      { current: 7, expected: [1, 'ellipsis', 6, 7, 8, 9, 10], total: 10 },
      { current: 10, expected: [1, 'ellipsis', 6, 7, 8, 9, 10], total: 10 },
      { current: 99, expected: [1, 'ellipsis', 6, 7, 8, 9, 10], total: 10 },
    ] as const
    const implementations = [reactPaginationRange, vuePaginationRange, sveltePaginationRange]

    for (const implementation of implementations) {
      for (const testCase of cases) {
        expect(implementation(testCase.current, testCase.total)).toEqual(testCase.expected)
      }
    }
  })

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
      expect(report.render.markup, name).toContain('aria-busy="false"')
      expect(report.render.markup, name).toContain('aria-live="polite"')
      expect(report.render.markup, name).toContain('data-slot="table-pagination"')
      expect(report.render.markup, name).toContain('hp-table-pagination-info')
      const rendered = browser.document.createElement('div')
      rendered.innerHTML = report.render.markup
      expect(rendered.querySelector('[data-slot="badge"]')?.getAttribute('data-variant'), name).toBe('secondary')
      expect(rendered.querySelector('[aria-label="Row actions"]')?.classList.contains('hp-action-trigger'), name).toBe(true)
      expect(rendered.querySelector('th[aria-sort] button')?.getAttribute('data-variant'), name).toBe('ghost')
      expect(rendered.querySelector('.hp-table-pagination-pages button')?.getAttribute('data-variant'), name).toBe('outline')
      rendered.innerHTML = report.loadingMarkup
      expect(rendered.querySelector('table thead th[scope="col"]'), name).not.toBeNull()
      expect(rendered.querySelector('table tbody [data-slot="table-loading"]'), name).not.toBeNull()
      expect(rendered.querySelector('td[data-label="Title"]'), name).toBeNull()
      rendered.innerHTML = report.emptyMarkup
      expect(rendered.querySelector('table thead th[scope="col"]'), name).not.toBeNull()
      expect(rendered.querySelector('table tbody [data-slot="table-empty"]'), name).not.toBeNull()
      expect(rendered.querySelector('[data-slot="table-loading"]'), name).toBeNull()
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
