import { reactive } from 'vue'

const route = reactive({ fullPath: '/admin/posts' })
let navigate = (_path: string): Promise<void> => Promise.resolve()
let fetcher: (path: string, options: Readonly<Record<string, unknown>>) => Promise<unknown> = async () => {
  throw new Error('Nuxt request fetch is not configured')
}

export function configureNuxtNavigation(handler: (path: string) => Promise<void>): void {
  navigate = handler
}

export function configureNuxtImports(options: {
  readonly fetch: (path: string, request: Readonly<Record<string, unknown>>) => Promise<unknown>
  readonly path: string
}): void {
  fetcher = options.fetch
  route.fullPath = options.path
}

export function createError(input: { readonly statusCode: number, readonly statusMessage: string }): Error {
  return Object.assign(new Error(input.statusMessage), input)
}

export async function useAsyncData<TValue>(_key: string, handler: () => Promise<TValue>): Promise<{
  readonly data: { readonly value: TValue | null }
  readonly error: { readonly value: Error | null }
}> {
  try {
    return { data: { value: await handler() }, error: { value: null } }
  } catch (cause) {
    return { data: { value: null }, error: { value: cause instanceof Error ? cause : new Error(String(cause)) } }
  }
}

export function useRequestFetch(): typeof fetcher {
  return fetcher
}

export function useRoute(): { readonly fullPath: string } {
  return route
}

export function showError(input: Error): void {
  throw input
}

export function useRouter(): { readonly push: (path: string) => Promise<void>, readonly replace: (path: string) => Promise<void> } {
  return { push: navigate, replace: navigate }
}
