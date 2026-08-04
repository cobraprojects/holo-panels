let currentPath = '/admin/posts'
let fetcher: (path: string, options: Readonly<Record<string, unknown>>) => Promise<unknown> = async () => {
  throw new Error('Nuxt request fetch is not configured')
}

export function configureNuxtImports(options: {
  readonly fetch: (path: string, request: Readonly<Record<string, unknown>>) => Promise<unknown>
  readonly path: string
}): void {
  currentPath = options.path
  fetcher = options.fetch
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
  return { fullPath: currentPath }
}
