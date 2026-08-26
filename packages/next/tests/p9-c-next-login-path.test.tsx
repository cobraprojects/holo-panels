import { describe, expect, it, vi } from 'vitest'
import { definePage, definePanel, type HoloAuth } from '@holo-js/panels-core'
import { createPanelPage } from '../src/page'
import type { NextPanelsRuntime } from '../src/contracts'

const redirect = vi.hoisted(() => vi.fn((destination: string): never => {
  throw new Error(`redirect:${destination}`)
}))

vi.mock('next/headers.js', () => ({
  headers: async () => new Headers({ host: 'example.test' }),
}))

vi.mock('next/navigation.js', () => ({
  forbidden: () => { throw new Error('forbidden') },
  notFound: () => { throw new Error('not-found') },
  redirect,
}))

class Actor {
  declare readonly id: number
}

const panel = definePanel('admin', Actor).path('/admin').login().loginRouteSlug('sign-in').compile()
const posts = definePage('posts', { load: () => ({}) }).path('/admin/posts').compile()
const auth: HoloAuth<object> = {
  guard: () => ({ provider: async () => 'session', user: async () => null }),
}
const runtime: NextPanelsRuntime = {
  auth,
  registry: {
    'admin:page:posts': async () => posts,
    'admin:panel:admin': async () => panel,
  },
}

describe('Next generated panel login route', () => {
  it('redirects unauthenticated requests to the panel-configured login path', async () => {
    const page = createPanelPage({ panelId: 'admin', runtime })

    await expect(page({ params: Promise.resolve({ panelsPath: ['posts'] }) })).rejects.toThrow('redirect:/admin/sign-in?next=%2Fadmin%2Fposts')
    expect(redirect).toHaveBeenCalledWith('/admin/sign-in?next=%2Fadmin%2Fposts')
  })
})
