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
  | 'presentation'
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

export interface PanelAuthPresentation {
  readonly appearance: Readonly<{
    readonly colors: Readonly<Record<string, string>>
    readonly density: 'comfortable' | 'compact'
    readonly fontFamily: string | null
    readonly monoFontFamily: string | null
    readonly serifFontFamily: string | null
    readonly tokens: Readonly<Record<string, string>>
  }>
  readonly brandName: string
  readonly forgotPasswordPath: string | null
  readonly loginPath: string | null
  readonly registrationPath: string | null
  readonly simplePageMaxContentWidth: string
  readonly theme: 'dark' | 'light' | 'system'
}

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

export async function executePanelAuthRequest(options: ExecutePanelAuthRequestOptions): Promise<PanelAuthRequestResult> {
  if (!PANEL_ID.test(options.panelId)) throw new Error('Panel authentication requires a stable panel ID')
  const destination = options.operation === 'mfa-challenge' || options.operation === 'mfa-recovery'
    ? requestedPanelDestination()
    : null
  const payload = destination ? { ...options.payload, destination } : options.payload
  const response = await (options.fetch ?? globalThis.fetch)(`/holo/panels/${encodeURIComponent(options.panelId)}/auth/${options.operation}`, {
    ...(options.operation === 'mfa-enrollment-begin' || options.operation === 'mfa-status' || options.operation === 'presentation' || options.operation === 'profile-read' ? {} : { body: JSON.stringify(payload) }),
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': options.csrfToken,
    },
    method: options.operation === 'mfa-enrollment-begin' || options.operation === 'mfa-status' || options.operation === 'presentation' || options.operation === 'profile-read' ? 'GET' : 'POST',
  })
  const contentType = response.headers.get('content-type') ?? ''
  const data: unknown = contentType.includes('application/json') ? await response.json() : null
  return Object.freeze({ data, ok: response.ok, status: response.status, url: response.ok && response.redirected ? response.url : null })
}

function authPresentation(value: unknown): PanelAuthPresentation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Panel authentication presentation is invalid')
  const presentation = value as Partial<PanelAuthPresentation>
  if (typeof presentation.brandName !== 'string' || typeof presentation.simplePageMaxContentWidth !== 'string') throw new Error('Panel authentication presentation is invalid')
  if (presentation.theme !== 'dark' && presentation.theme !== 'light' && presentation.theme !== 'system') throw new Error('Panel authentication presentation is invalid')
  if (typeof presentation.appearance !== 'object' || presentation.appearance === null) throw new Error('Panel authentication presentation is invalid')
  return presentation as PanelAuthPresentation
}

export async function loadPanelAuthPresentation(panelId: string, fetch?: typeof globalThis.fetch): Promise<PanelAuthPresentation> {
  const result = await executePanelAuthRequest({ csrfToken: '', fetch, operation: 'presentation', panelId, payload: {} })
  if (!result.ok) throw new Error('Panel authentication presentation could not be loaded')
  return authPresentation(result.data)
}
import { requestedPanelDestination } from './destination'
