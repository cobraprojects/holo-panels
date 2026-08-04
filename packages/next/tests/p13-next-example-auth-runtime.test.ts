import { describe, expect, it, vi } from 'vitest'
import { adaptPanelAuthGuard } from '../../../apps/example-next/server/admin/runtime'

describe('Next example panel auth bridge', () => {
  it('preserves provider and one-time session effects from the Holo guard', async () => {
    const flash = vi.fn(async (_key = '', _values = [{}]) => undefined)
    const takeKeys: string[] = []
    const take = async <TValue = unknown>(key: string): Promise<TValue | undefined> => {
      takeKeys.push(key)
      return [{ kind: 'toast', level: 'success', message: 'Saved' }] as TValue
    }
    const guard = adaptPanelAuthGuard({
      flash,
      provider: async () => 'admins',
      take,
      user: async () => ({ id: 7 }),
    })

    await guard.flash?.('panels.effects.admin', [{ kind: 'toast' }])

    expect(await guard.provider()).toBe('admins')
    expect(await guard.take?.('panels.effects.admin')).toEqual([{ kind: 'toast', level: 'success', message: 'Saved' }])
    expect(await guard.user()).toEqual({ id: 7 })
    expect(flash).toHaveBeenCalledWith('panels.effects.admin', [{ kind: 'toast' }])
    expect(takeKeys).toEqual(['panels.effects.admin'])
  })
})
