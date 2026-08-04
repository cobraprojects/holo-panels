import { Window } from 'happy-dom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { InfolistActionAcceptanceFixture } from '../src/infolist-action-acceptance/contracts'
import { runInfolistActionAcceptanceJourney } from '../src/infolist-action-acceptance/journey'

const browser = new Window({ url: 'http://localhost/' })
let fixtures: readonly [string, InfolistActionAcceptanceFixture][] = []

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
    import('../../../apps/example-next/tests/p8-infolist-action-acceptance-next'),
    import('../../../apps/example-nuxt/tests/p8-infolist-action-acceptance-nuxt'),
    import('../../../apps/example-sveltekit/tests/p8-infolist-action-acceptance-sveltekit'),
  ])
  fixtures = [
    ['Next', next.nextInfolistActionAcceptanceFixture],
    ['Nuxt', nuxt.nuxtInfolistActionAcceptanceFixture],
    ['SvelteKit', svelteKit.svelteKitInfolistActionAcceptanceFixture],
  ]
})

afterAll(async () => browser.close())

describe('P8 infolist and action phase-gate acceptance', () => {
  it('runs identical accessible entry and modal action contracts through every renderer', async () => {
    expect(fixtures).toHaveLength(3)
    for (const [name, fixture] of fixtures) {
      const report = await runInfolistActionAcceptanceJourney(fixture)

      expect(report.framework, name).toBe(fixture.framework)
      expect(report.render.ssrStable, name).toBe(true)
      expect(report.render.markup, name).toContain('data-panels-entry="title"')
      expect(report.render.markup, name).toContain('Cairo Guide')
      expect(report.render.markup, name).toContain('aria-label="Yes"')
      expect(report.render.markup, name).toContain('<dl>')
      expect(report.render.markup, name).toContain('<ol>')
      expect(report.entryActions, name).toEqual(['inspect'])
      expect(report.submittingMarkup, name).toContain('Working…')
      expect(report.requests, name).toHaveLength(2)
      expect(report.requests[0], name).toEqual({ actionId: 'posts.publish', input: { reason: 'Reviewed' }, recordIds: [42] })
      expect(report.successMarkup, name).toContain('Action completed')
      expect(report.activeDialogCount, name).toBe(1)
      expect(report.remainingDialogCount, name).toBe(1)
      expect(report.deniedMarkup, name).toContain('role="alert"')
      expect(report.deniedMarkup, name).toContain('Action denied by policy')
      expect(report.requests[1], name).toEqual({ actionId: 'posts.denied', input: {}, recordIds: [42] })
      expect(browser.document.body.childElementCount, name).toBe(0)
    }
  })
})
