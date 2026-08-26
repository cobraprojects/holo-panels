import { HoloSecurityCsrfProvider } from '../transport/csrf'
import { requestedPanelDestination } from './destination'

export interface PanelLoginCredentials {
  readonly email: string
  readonly password: string
}

export interface ExecutePanelLoginOptions {
  readonly credentials: PanelLoginCredentials
  readonly csrfToken: string
  readonly fetch?: typeof globalThis.fetch
  readonly panelId: string
}

export interface PanelLoginResult {
  readonly error: 'authentication' | 'request' | 'security' | null
  readonly ok: boolean
  readonly status: number
  readonly url: string | null
}

export function panelLoginErrorMessage(result: PanelLoginResult): string {
  if (result.error === 'authentication') return 'These credentials do not match our records.'
  if (result.error === 'security') return 'Your session expired. Refresh the page and try again.'
  return 'Sign in failed. Please try again.'
}

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

async function submitLogin(
  fetcher: typeof globalThis.fetch,
  panelId: string,
  credentials: PanelLoginCredentials,
  csrfToken: string,
  destination: string | null,
): Promise<Response> {
  return await fetcher(`/holo/panels/${encodeURIComponent(panelId)}/auth/login`, {
    body: JSON.stringify({ credentials, ...(destination ? { destination } : {}) }),
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    method: 'POST',
  })
}

interface LoginFailureDetails {
  readonly code: string | null
  readonly status: number
}

function invalidCredentialsPayload(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (Reflect.get(value, 'code') === 'invalid-credentials') return true
  const errors = Reflect.get(value, 'errors')
  if (typeof errors !== 'object' || errors === null) return false
  return Object.values(errors).some(messages => Array.isArray(messages) && messages.includes('These credentials do not match our records.'))
}

async function responseFailureDetails(response: Response): Promise<LoginFailureDetails> {
  const fallback = { code: null, status: response.status }
  if (!response.headers.get('content-type')?.includes('application/json')) return fallback
  try {
    const value: unknown = await response.json()
    if (invalidCredentialsPayload(value)) return { code: 'invalid-credentials', status: response.status }
    if (typeof value !== 'object' || value === null || Reflect.get(value, 'type') !== 'failure') return fallback
    const serialized = Reflect.get(value, 'data')
    if (typeof serialized !== 'string') return fallback
    const failure: unknown = JSON.parse(serialized)
    const status = typeof failure === 'object' && failure !== null && typeof Reflect.get(failure, 'status') === 'number'
      ? Reflect.get(failure, 'status') as number
      : response.status
    return { code: invalidCredentialsPayload(failure) ? 'invalid-credentials' : null, status }
  } catch {
    return fallback
  }
}

async function loginResult(response: Response): Promise<PanelLoginResult> {
  const failure = await responseFailureDetails(response)
  if (response.ok && failure.code === null && failure.status < 400) return Object.freeze({ error: null, ok: true, status: response.status, url: response.url || null })
  const error = failure.status === 419
    ? 'security'
    : failure.code === 'invalid-credentials'
      ? 'authentication'
      : 'request'
  return Object.freeze({ error, ok: false, status: failure.status, url: null })
}

async function refreshCsrfToken(fetcher: typeof globalThis.fetch, staleToken: string): Promise<string | null> {
  const currentUrl = globalThis.location?.href
  if (!currentUrl) return null
  await fetcher(currentUrl, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'text/html' },
    method: 'GET',
  })
  const refreshedToken = new HoloSecurityCsrfProvider().getField()?.value
  return refreshedToken && refreshedToken !== staleToken ? refreshedToken : null
}

export async function executePanelLogin(options: ExecutePanelLoginOptions): Promise<PanelLoginResult> {
  if (!PANEL_ID.test(options.panelId)) throw new Error('Panel login requires a stable panel ID')
  const email = options.credentials.email.trim()
  if (!email || !options.credentials.password) return Object.freeze({ error: 'authentication', ok: false, status: 422, url: null })
  const fetcher = options.fetch ?? globalThis.fetch
  const credentials = Object.freeze({ email, password: options.credentials.password })
  const destination = requestedPanelDestination()
  let response = await submitLogin(fetcher, options.panelId, credentials, options.csrfToken, destination)
  if (response.status === 419) {
    const refreshedToken = await refreshCsrfToken(fetcher, options.csrfToken)
    if (refreshedToken) response = await submitLogin(fetcher, options.panelId, credentials, refreshedToken, destination)
  }
  return await loginResult(response)
}
