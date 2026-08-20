'use client'

import { executePanelAuthRequest, panelContentWidthValue } from '@holo-js/panels-react'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { nextPanelAuthAppearanceVariables, type NextPanelAuthAppearance } from './auth-appearance'
import { ShadcnButton, ShadcnCard, ShadcnCardContent, ShadcnCardHeader, ShadcnIcon, ShadcnInput, ShadcnLabel, ShadcnSelect } from './internal-ui'

export type NextPanelAuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'

export interface NextPanelAuthPageProps {
  readonly appearance?: NextPanelAuthAppearance
  readonly brandName: string
  readonly loginPath?: string
  readonly panelId: string
  readonly simplePageMaxContentWidth?: string
  readonly theme?: 'dark' | 'light' | 'system'
  readonly themeColors?: Readonly<Record<string, string>>
  readonly type: NextPanelAuthPageType
}

const pageText: Readonly<Record<NextPanelAuthPageType, readonly [string, string]>> = Object.freeze({
  'email-verification': ['Verify your email', 'Use the verification link in your email, or request another one.'],
  'email-verification-verify': ['Verify your email', 'Confirm the verification link for your account.'],
  'mfa-challenge': ['Two-factor authentication', 'Enter the code from your authenticator application.'],
  'password-reset': ['Reset your password', 'Choose a new password for your account.'],
  'password-reset-request': ['Forgot password', 'Enter your email and we will send a reset link.'],
  registration: ['Create an account', 'Register to access this panel.'],
})

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function fields(type: NextPanelAuthPageType, panelId: string): ReactNode {
  if (type === 'email-verification' || type === 'email-verification-verify') return null
  if (type === 'mfa-challenge') return <><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-method`}>Verification method</ShadcnLabel><ShadcnSelect id={`${panelId}-method`} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></ShadcnSelect></div><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-code`}>Authentication code</ShadcnLabel><ShadcnInput autoComplete="one-time-code" id={`${panelId}-code`} inputMode="numeric" name="code" required /></div></>
  if (type === 'password-reset-request') return <div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-email`}>Email</ShadcnLabel><ShadcnInput autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div>
  return <>
    {type === 'registration' ? <><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-name`}>Name</ShadcnLabel><ShadcnInput autoComplete="name" id={`${panelId}-name`} name="name" required /></div><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-email`}>Email</ShadcnLabel><ShadcnInput autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div></> : null}
    <div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-password`}>Password</ShadcnLabel><ShadcnInput autoComplete="new-password" id={`${panelId}-password`} name="password" type="password" required /></div>
    <div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-password-confirmation`}>Confirm password</ShadcnLabel><ShadcnInput autoComplete="new-password" id={`${panelId}-password-confirmation`} name="passwordConfirmation" type="password" required /></div>
  </>
}

function request(type: NextPanelAuthPageType, data: FormData): { readonly operation: Parameters<typeof executePanelAuthRequest>[0]['operation'], readonly payload: Readonly<Record<string, unknown>> } {
  if (type === 'email-verification') return { operation: 'email-verification-resend', payload: {} }
  if (type === 'email-verification-verify') return { operation: 'email-verification-verify', payload: { token: new URLSearchParams(location.search).get('token') ?? '' } }
  if (type === 'mfa-challenge') return { operation: data.get('method') === 'recovery' ? 'mfa-recovery' : 'mfa-challenge', payload: { code: String(data.get('code') ?? '') } }
  if (type === 'password-reset-request') return { operation: 'password-reset-request', payload: { email: String(data.get('email') ?? '') } }
  const password = String(data.get('password') ?? '')
  const passwordConfirmation = String(data.get('passwordConfirmation') ?? '')
  if (type === 'password-reset') return { operation: 'password-reset', payload: { password, passwordConfirmation, token: new URLSearchParams(location.search).get('token') ?? '' } }
  return { operation: 'registration', payload: { credentials: { email: String(data.get('email') ?? ''), name: String(data.get('name') ?? ''), password, passwordConfirmation } } }
}

export function NextPanelAuthPage({ appearance, brandName, loginPath, panelId, simplePageMaxContentWidth, theme = 'system', themeColors, type }: NextPanelAuthPageProps) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [title, description] = pageText[type]
  const style = { ...nextPanelAuthAppearanceVariables(appearance, themeColors), ...(simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } : {}) } as CSSProperties

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setMessage('')
    setPending(true)
    try {
      const authRequest = request(type, new FormData(event.currentTarget))
      const result = await executePanelAuthRequest({ ...authRequest, csrfToken: cookie('XSRF-TOKEN'), panelId })
      if (!result.ok) {
        setError('The request could not be completed. Check the entered information and try again.')
        return
      }
      if (result.url) {
        location.assign(result.url)
        return
      }
      setMessage(type === 'password-reset-request' || type === 'email-verification' ? 'The email has been sent.' : 'Your changes were saved.')
    } finally {
      setPending(false)
    }
  }

  return <main className="hp-auth-page" data-density={appearance?.density} data-holo-panel data-theme={theme} style={style}>
    <ShadcnCard className="hp-auth-card">
      <ShadcnCardHeader><span className="hp-auth-brand-mark"><ShadcnIcon name={type === 'registration' ? 'user' : 'key'} /></span><div><p>{brandName}</p><h1>{title}</h1><span>{description}</span></div></ShadcnCardHeader>
      <ShadcnCardContent><form onSubmit={submit}>{fields(type, panelId)}{error ? <p className="hp-auth-error" role="alert">{error}</p> : null}{message ? <p className="hp-auth-success" role="status">{message}</p> : null}<ShadcnButton className="hp-button hp-button-primary" disabled={pending} type="submit">{pending ? 'Please wait…' : type === 'email-verification' ? 'Resend verification email' : type === 'email-verification-verify' ? 'Verify email' : type === 'mfa-challenge' ? 'Verify' : 'Continue'}</ShadcnButton></form>{loginPath ? <p className="hp-auth-footer"><a href={loginPath}>Back to sign in</a></p> : null}</ShadcnCardContent>
    </ShadcnCard>
  </main>
}
