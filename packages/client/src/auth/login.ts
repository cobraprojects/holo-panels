import { HoloSecurityCsrfProvider } from '../transport/csrf'

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
  readonly ok: boolean
  readonly url: string | null
}

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

async function submitLogin(
  fetcher: typeof globalThis.fetch,
  panelId: string,
  credentials: PanelLoginCredentials,
  csrfToken: string,
): Promise<Response> {
  return await fetcher(`/holo/panels/${encodeURIComponent(panelId)}/auth/login`, {
    body: JSON.stringify({ credentials }),
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    method: 'POST',
  })
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
  if (!email || !options.credentials.password) return Object.freeze({ ok: false, url: null })
  const fetcher = options.fetch ?? globalThis.fetch
  const credentials = Object.freeze({ email, password: options.credentials.password })
  let response = await submitLogin(fetcher, options.panelId, credentials, options.csrfToken)
  if (response.status === 419) {
    const refreshedToken = await refreshCsrfToken(fetcher, options.csrfToken)
    if (refreshedToken) response = await submitLogin(fetcher, options.panelId, credentials, refreshedToken)
  }
  return Object.freeze({ ok: response.ok, url: response.ok ? response.url : null })
}
