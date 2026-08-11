import type { NuxtPanelPage, UsePanelPageOptions } from './contracts'
import { assertPanelId, normalizePanelLocation } from './validation'

interface NuxtImports {
  createError(input: { readonly statusCode: number, readonly statusMessage: string }): Error
  useAsyncData<TValue>(key: string, handler: () => Promise<TValue>): Promise<{ readonly data: { readonly value: TValue | null }, readonly error: { readonly value: Error | null } }>
  useRequestFetch(): (path: string, options: Readonly<Record<string, unknown>>) => Promise<unknown>
  useRoute(): { readonly fullPath: string }
}

async function nuxtImports(): Promise<NuxtImports> {
  return await import('#imports') as unknown as NuxtImports
}

function pageEndpoint(panelId: string): string {
  return `/holo/panels/${encodeURIComponent(panelId)}/page-data`
}

function isPage(value: unknown): value is NuxtPanelPage {
  if (!value || typeof value !== 'object') return false
  const page = value as Partial<NuxtPanelPage>
  return typeof page.path === 'string'
    && !!page.bootstrap
    && typeof page.bootstrap === 'object'
    && !!page.page
    && typeof page.page === 'object'
}

export async function usePanelPage(options: UsePanelPageOptions): Promise<NuxtPanelPage> {
  assertPanelId(options.panelId)
  const imports = options.path ? null : await nuxtImports()
  const path = normalizePanelLocation(options.path ?? imports?.useRoute().fullPath ?? '/')
  const controller = new AbortController()
  if (options.load) return await options.load({ panelId: options.panelId, path, signal: controller.signal })
  if (!imports) throw new Error('Nuxt panel page loading requires a Nuxt request context')
  const requestFetch = imports.useRequestFetch()
  const state = await imports.useAsyncData(`holo-panels:${options.panelId}:${path}`, async () => {
    const payload = await requestFetch(pageEndpoint(options.panelId), { method: 'GET', query: { path }, signal: controller.signal })
    if (!isPage(payload)) throw imports.createError({ statusCode: 500, statusMessage: 'The generated Holo Panels registry returned an invalid page payload.' })
    return payload
  })
  if (state.error.value) throw state.error.value
  if (!state.data.value) throw imports.createError({ statusCode: 503, statusMessage: 'Run holo prepare to generate the Holo Panels server registry.' })
  return state.data.value
}
