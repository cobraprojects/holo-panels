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

export async function executePanelLogin(options: ExecutePanelLoginOptions): Promise<PanelLoginResult> {
  if (!PANEL_ID.test(options.panelId)) throw new Error('Panel login requires a stable panel ID')
  const email = options.credentials.email.trim()
  if (!email || !options.credentials.password) return Object.freeze({ ok: false, url: null })
  const fetcher = options.fetch ?? globalThis.fetch
  const response = await fetcher(`/holo/panels/${encodeURIComponent(options.panelId)}/auth/login`, {
    body: JSON.stringify({ credentials: { email, password: options.credentials.password } }),
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': options.csrfToken,
    },
    method: 'POST',
  })
  return Object.freeze({ ok: response.ok, url: response.ok ? response.url : null })
}
