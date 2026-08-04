import { describe, expect, it } from 'vitest'
import { runHoloNotificationRuntimeAcceptance } from './fixtures/holo-notification-runtime'

describe('P13 queued Holo notification runtime acceptance', () => {
  it('stores, scopes, refreshes, and mutates database notifications through the real Holo runtime', async () => {
    const report = await runHoloNotificationRuntimeAcceptance()

    expect(report.dispatchQueued).toBe(true)
    expect(report.queueDelivery).toEqual({
      connection: 'acceptance',
      jobName: 'holo.notifications.deliver',
      queue: 'notifications',
    })
    expect(report.broadcastInvalidations).toBe(3)
    expect(report.realtimeDeliveries).toBe(6)
    expect(report.realtimeCoalesced).toBe(true)
    expect(report.duplicateItemsPrevented).toBe(true)
    expect(report.pollingContinued).toBe(true)
    expect(report.clientRefreshes).toBeGreaterThan(0)
    expect(report.contractAtomicMutationScope).toBe(true)
    expect(report.contractJsonScalarMatching).toBe(true)
    expect(report.contractPagination).toBe(true)
    expect(report.initialUnread).toBe(1)
    expect(report.adminTenantIsolation).toBe(true)
    expect(report.vendorGuardIsolation).toBe(true)
    expect(report.unauthorizedGuardRejected).toBe(true)
    expect(report.markedRead).toBe(true)
    expect(report.markedUnread).toBe(true)
    expect(report.navigationUrl).toBe('/orders/42')
    expect(report.deleted).toBe(true)
    expect(report.storedCount).toBe(2)
  })
})
