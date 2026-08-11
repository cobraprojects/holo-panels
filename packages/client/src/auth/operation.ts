export type PanelClientAuthOperation =
  | 'email-verification-resend'
  | 'email-verification-verify'
  | 'logout'
  | 'mfa-challenge'
  | 'mfa-disable'
  | 'mfa-enrollment-begin'
  | 'mfa-enrollment-confirm'
  | 'mfa-recovery'
  | 'mfa-recovery-codes-regenerate'
  | 'mfa-status'
  | 'password-reset-request'
  | 'password-reset'
  | 'profile-read'
  | 'profile-update'
  | 'registration'

export interface ExecutePanelAuthRequestOptions {
  readonly csrfToken: string
  readonly fetch?: typeof globalThis.fetch
  readonly operation: PanelClientAuthOperation
  readonly panelId: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface PanelAuthRequestResult {
  readonly data: unknown
  readonly ok: boolean
  readonly status: number
  readonly url: string | null
}

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

export async function executePanelAuthRequest(options: ExecutePanelAuthRequestOptions): Promise<PanelAuthRequestResult> {
  if (!PANEL_ID.test(options.panelId)) throw new Error('Panel authentication requires a stable panel ID')
  const response = await (options.fetch ?? globalThis.fetch)(`/holo/panels/${encodeURIComponent(options.panelId)}/auth/${options.operation}`, {
    ...(options.operation === 'mfa-enrollment-begin' || options.operation === 'mfa-status' || options.operation === 'profile-read' ? {} : { body: JSON.stringify(options.payload) }),
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': options.csrfToken,
    },
    method: options.operation === 'mfa-enrollment-begin' || options.operation === 'mfa-status' || options.operation === 'profile-read' ? 'GET' : 'POST',
  })
  const contentType = response.headers.get('content-type') ?? ''
  const data: unknown = contentType.includes('application/json') ? await response.json() : null
  return Object.freeze({ data, ok: response.ok, status: response.status, url: response.ok && response.redirected ? response.url : null })
}
