import { describe, expect, it } from 'vitest'
import { nextNotificationAcceptanceFixture } from '../../../apps/example-next/tests/p13-notification-acceptance-next'
import { nuxtNotificationAcceptanceFixture } from '../../../apps/example-nuxt/tests/p13-notification-acceptance-nuxt'
import { svelteKitNotificationAcceptanceFixture } from '../../../apps/example-sveltekit/tests/p13-notification-acceptance-sveltekit'
import { runNotificationAcceptanceJourney } from '../src/notification-acceptance'

describe('P13 notifications phase gate', () => {
  it('renders temporary and database notification behavior across every example app', async () => {
    for (const fixture of [nextNotificationAcceptanceFixture, nuxtNotificationAcceptanceFixture, svelteKitNotificationAcceptanceFixture]) {
      const report = await runNotificationAcceptanceJourney(fixture)

      expect(report.render.ssrStable).toBe(true)
      expect(report.render.markup).toContain('aria-live="polite"')
      expect(report.render.markup).toContain('Notification queue')
      expect(report.render.markup).toContain('Draft saved')
      expect(report.render.markup).toContain('Deployment ready')
      expect(report.render.markup).toContain('data-persistent="true"')
      expect(report.render.markup).toContain('data-placement="bottom"')
      expect(report.render.markup).toContain('Notification inbox')
      expect(report.render.markup).toContain('data-placement="sidebar"')
      expect(report.render.markup).toContain('Custom release: Release deployed')
      expect(report.render.markup).toContain('Page')
      expect(report.render.markup).toContain('Next notification page')
      expect(report.render.markup).toContain('Acknowledge')
      expect(report.render.markup).toContain('Delete')
      expect(report.actionObserved).toBe('open-deployment')
      expect(report.toastQueueSize).toBe(2)
      expect(report.persistentQueued).toBe(true)
      expect(report.loadedPage).toBe(2)
      expect(report.markedRead).toBe(true)
      expect(report.deleted).toBe(true)
    }
  })
})
