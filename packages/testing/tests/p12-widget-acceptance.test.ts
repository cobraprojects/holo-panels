import { describe, expect, it } from 'vitest'
import { runWidgetAcceptanceJourney } from '../src/widget-acceptance'
import { loadExampleExport } from './load-example'

type WidgetAcceptanceFixture = Parameters<typeof runWidgetAcceptanceJourney>[0]

const [nextWidgetAcceptanceFixture, nuxtWidgetAcceptanceFixture, svelteKitWidgetAcceptanceFixture] = await Promise.all([
  loadExampleExport<WidgetAcceptanceFixture>('next', 'p12-widget-acceptance-next', 'nextWidgetAcceptanceFixture'),
  loadExampleExport<WidgetAcceptanceFixture>('nuxt', 'p12-widget-acceptance-nuxt', 'nuxtWidgetAcceptanceFixture'),
  loadExampleExport<WidgetAcceptanceFixture>('sveltekit', 'p12-widget-acceptance-sveltekit', 'svelteKitWidgetAcceptanceFixture'),
])

describe('P12 widgets and dashboards phase gate', () => {
  it('renders stats, chart, table, and custom widgets on dashboards and resource pages in every example app', async () => {
    for (const fixture of [nextWidgetAcceptanceFixture, nuxtWidgetAcceptanceFixture, svelteKitWidgetAcceptanceFixture]) {
      const report = await runWidgetAcceptanceJourney(fixture)

      expect(report.render.ssrStable).toBe(true)
      expect(report.render.markup).toContain('Overview dashboard')
      expect(report.render.markup).toContain('Revenue')
      expect(report.render.markup).toContain('year:120')
      expect(report.render.markup).toContain('Monthly revenue')
      expect(report.render.markup).toContain('Order 1001')
      expect(report.render.markup).toContain('Sunny')
      expect(report.render.markup).toContain('header widgets')
      expect(report.render.markup).toContain('footer widgets')
      expect(report.render.markup).toContain('Resource sunshine')
      expect(report.filteredValue).toBe('year:120')
      expect(report.pollingCancelled).toBe(true)
    }
  })
})
