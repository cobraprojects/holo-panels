import type { NuxtPanelPage, UsePanelPageOptions } from './contracts'
import { shallowReactive, watch } from 'vue'
import { assertPanelId, normalizePanelLocation } from './validation'

interface NuxtImports {
  createError(input: { readonly statusCode: number, readonly statusMessage: string }): Error
  showError(input: Error): void
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

async function loadPage(
  imports: NuxtImports,
  panelId: string,
  path: string,
  signal: AbortSignal,
): Promise<NuxtPanelPage> {
  const payload = await imports.useRequestFetch()(pageEndpoint(panelId), { method: 'GET', query: { path }, signal })
  if (!isPage(payload)) throw imports.createError({ statusCode: 500, statusMessage: 'The generated Holo Panels registry returned an invalid page payload.' })
  return payload
}

export async function usePanelPage(options: UsePanelPageOptions): Promise<NuxtPanelPage> {
  assertPanelId(options.panelId)
  if (options.load) {
    const path = normalizePanelLocation(options.path ?? '/')
    return await options.load({ panelId: options.panelId, path, signal: new AbortController().signal })
  }
  const imports = await nuxtImports()
  const route = imports.useRoute()
  const path = normalizePanelLocation(options.path ?? route.fullPath)
  const controller = new AbortController()
  const state = await imports.useAsyncData(`holo-panels:${options.panelId}:${path}`, async () => {
    return await loadPage(imports, options.panelId, path, controller.signal)
  })
  if (state.error.value) throw state.error.value
  if (!state.data.value) throw imports.createError({ statusCode: 503, statusMessage: 'Run holo prepare to generate the Holo Panels server registry.' })
  const currentPage = shallowReactive(state.data.value)
  if (!options.path) {
    let navigationController: AbortController | undefined
    watch(() => route.fullPath, (nextLocation) => {
      const nextPath = normalizePanelLocation(nextLocation)
      if (nextPath === currentPage.path) return
      navigationController?.abort()
      navigationController = new AbortController()
      const activeController = navigationController
      void loadPage(imports, options.panelId, nextPath, activeController.signal).then((nextPage) => {
        if (!activeController.signal.aborted) Object.assign(currentPage, nextPage)
      }).catch((error: unknown) => {
        if (!activeController.signal.aborted) imports.showError(error instanceof Error ? error : new Error('The panel page could not be loaded.'))
      })
    })
  }
  return currentPage
}
