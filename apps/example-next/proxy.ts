import { csrfProtection } from '@holo-js/security/next/server'

const csrf = csrfProtection()
const PANEL_OPERATION = /^\/holo\/panels\/[^/]+\/[^/]+$/u
const MAX_PANEL_REQUEST_BYTES = 1_048_576

export async function proxy(request: Parameters<typeof csrf>[0]) {
  const path = request.nextUrl?.pathname ?? new URL(request.url).pathname
  if (request.method === 'POST' && PANEL_OPERATION.test(path)) {
    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PANEL_REQUEST_BYTES) {
      return new Response('Payload Too Large', { status: 413 })
    }
    return undefined
  }
  return csrf(request)
}

export const config = {
  matcher: ['/admin/:path*', '/holo/panels/:path*'],
}
