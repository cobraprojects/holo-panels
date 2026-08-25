declare module '#imports' {
  export function createError(input: { readonly statusCode: number, readonly statusMessage: string }): Error
  export function useAsyncData<TValue>(key: string, handler: () => Promise<TValue>): Promise<{ readonly data: { readonly value: TValue | null }, readonly error: { readonly value: Error | null } }>
  export function useRequestFetch(): (path: string, options: Readonly<Record<string, unknown>>) => Promise<unknown>
  export function useRoute(): { readonly fullPath: string }
  export function useRouter(): { readonly push: (path: string) => Promise<unknown>, readonly replace: (path: string) => Promise<unknown> }
}
