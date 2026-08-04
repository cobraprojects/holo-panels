import { describe, expect, it } from 'vitest'
import { nextWidgetAcceptanceFixture } from '../../../apps/example-next/tests/p12-widget-acceptance-next'
import { nuxtWidgetAcceptanceFixture } from '../../../apps/example-nuxt/tests/p12-widget-acceptance-nuxt'
import { svelteKitWidgetAcceptanceFixture } from '../../../apps/example-sveltekit/tests/p12-widget-acceptance-sveltekit'
import { runWidgetAcceptanceJourney } from '../src/widget-acceptance'

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
