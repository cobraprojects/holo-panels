import { beforeAll, describe, expect, it } from 'vitest'
import type { InfolistActionAcceptanceFixture } from '../src/infolist-action-acceptance/contracts'
import { runInfolistActionAcceptanceJourney } from '../src/infolist-action-acceptance/journey'
import { loadExampleExport } from './load-example'

let fixtures: readonly [string, InfolistActionAcceptanceFixture][] = []

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const [next, nuxt, svelteKit] = await Promise.all([
    loadExampleExport<InfolistActionAcceptanceFixture>('next', 'p8-infolist-action-acceptance-next', 'nextInfolistActionAcceptanceFixture'),
    loadExampleExport<InfolistActionAcceptanceFixture>('nuxt', 'p8-infolist-action-acceptance-nuxt', 'nuxtInfolistActionAcceptanceFixture'),
    loadExampleExport<InfolistActionAcceptanceFixture>('sveltekit', 'p8-infolist-action-acceptance-sveltekit', 'svelteKitInfolistActionAcceptanceFixture'),
  ])
  fixtures = [
    ['Next', next],
    ['Nuxt', nuxt],
    ['SvelteKit', svelteKit],
  ]
})

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
      expect(report.requests[0], name).toEqual({ actionId: 'posts.publish', input: { reason: 'Reviewed' }, mount: 'record', recordIds: [42] })
      expect(report.successNotification, name).toEqual({ body: 'The operation completed successfully.', title: 'Action completed' })
      expect(report.successMarkup, name).not.toContain('role="dialog"')
      expect(report.activeDialogCount, name).toBe(1)
      expect(report.remainingDialogCount, name).toBe(1)
      expect(report.deniedMarkup, name).not.toContain('Action denied by policy')
      expect(report.deniedNotification, name).toEqual({ body: 'The operation could not be completed.', title: 'Action failed' })
      expect(report.requests[1], name).toEqual({ actionId: 'posts.denied', input: {}, mount: 'record', recordIds: [42] })
      expect(document.body.childElementCount, name).toBe(0)
    }
  })
})
