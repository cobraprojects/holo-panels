import { beforeEach, describe, expect, it, vi } from 'vitest'

const flash = vi.fn(async (_key = '', _values: readonly object[] = []) => undefined)
const take = vi.fn(async <TValue>(_key: string): Promise<TValue | undefined> => [{ kind: 'toast', level: 'success', message: 'Saved' }] as TValue)
const login = vi.fn(async () => ({ cookies: ['session=next'], guard: 'admins', provider: 'users', sessionId: 'session-1', user: { id: 7 } }))
const logout = vi.fn(async () => ({ cookies: ['session='], guard: 'admins' }))

vi.mock('@holo-js/adapter-next/runtime', () => ({
  createNextHoloHelpers: () => ({
    getAuth: async () => ({
      guard: () => ({
        flash,
        login,
        logout,
        provider: async () => 'admins',
        refreshUser: async () => ({ id: 7 }),
        take,
        user: async () => ({ id: 7 }),
      }),
    }),
  }),
}))

describe('Next generated panel auth bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves provider and one-time session effects from the Holo guard', async () => {
    const { createGeneratedNextPanelsRuntime } = await import('../src/generated-runtime')
    const runtime = createGeneratedNextPanelsRuntime({})
    const auth = typeof runtime.auth === 'function' ? await runtime.auth() : runtime.auth
    const guard = auth.guard('admins')

    await guard.flash?.('panels.effects.admin', [{ kind: 'toast' }])

    expect(await guard.provider()).toBe('admins')
    expect(await guard.take?.('panels.effects.admin')).toEqual([{ kind: 'toast', level: 'success', message: 'Saved' }])
    expect(await guard.user()).toEqual({ id: 7 })
    expect(flash).toHaveBeenCalledWith('panels.effects.admin', [{ kind: 'toast' }])
    expect(take).toHaveBeenCalledWith('panels.effects.admin')

    const guardLogin = Reflect.get(guard, 'login') as (credentials: Readonly<Record<string, unknown>>) => Promise<unknown>
    const guardLogout = Reflect.get(guard, 'logout') as () => Promise<unknown>
    expect(await Reflect.apply(guardLogin, guard, [{ email: 'admin@example.test', password: 'secret' }])).toEqual(expect.objectContaining({ cookies: ['session=next'] }))
    expect(await Reflect.apply(guardLogout, guard, [])).toEqual({ cookies: ['session='], guard: 'admins' })
    expect(login).toHaveBeenCalledWith({ email: 'admin@example.test', password: 'secret' })
  })

  it('exposes the generated runtime through the React server entry', async () => {
    const server = await import('../src/server')

    expect(server.createGeneratedNextPanelsRuntime).toBeTypeOf('function')
  })
})
