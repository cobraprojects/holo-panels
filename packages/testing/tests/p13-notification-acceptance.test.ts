import { describe, expect, it } from 'vitest'
import { runNotificationAcceptanceJourney } from '../src/notification-acceptance'
import { loadExampleExport } from './load-example'

type NotificationAcceptanceFixture = Parameters<typeof runNotificationAcceptanceJourney>[0]

const [nextNotificationAcceptanceFixture, nuxtNotificationAcceptanceFixture, svelteKitNotificationAcceptanceFixture] = await Promise.all([
  loadExampleExport<NotificationAcceptanceFixture>('next', 'p13-notification-acceptance-next', 'nextNotificationAcceptanceFixture'),
  loadExampleExport<NotificationAcceptanceFixture>('nuxt', 'p13-notification-acceptance-nuxt', 'nuxtNotificationAcceptanceFixture'),
  loadExampleExport<NotificationAcceptanceFixture>('sveltekit', 'p13-notification-acceptance-sveltekit', 'svelteKitNotificationAcceptanceFixture'),
])

describe('P13 notifications phase gate', () => {
  it('renders temporary and database notification behavior across every example app', async () => {
    for (const fixture of [nextNotificationAcceptanceFixture, nuxtNotificationAcceptanceFixture, svelteKitNotificationAcceptanceFixture]) {
      const report = await runNotificationAcceptanceJourney(fixture)

      expect(report.render.ssrStable).toBe(true)
      expect(report.render.markup).toContain('aria-live="polite"')
      expect(report.render.markup).toContain('Notification inbox')
      expect(report.render.markup).toContain('data-placement="sidebar"')
      expect(report.render.markup).toContain('Custom release: Release deployed')
      expect(report.render.markup).toContain('Page')
      expect(report.render.markup).toContain('Next notification page')
      expect(report.render.markup).toContain('Acknowledge')
      expect(report.render.markup).toContain('Remove')
      expect(report.actionObserved).toBe('open-deployment')
      expect(report.toastQueueSize).toBe(2)
      expect(report.persistentQueued).toBe(true)
      expect(report.loadedPage).toBe(2)
      expect(report.markedRead).toBe(true)
      expect(report.deleted).toBe(true)
    }
  })
})
