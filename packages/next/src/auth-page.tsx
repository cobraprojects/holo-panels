'use client'

import { executePanelAuthRequest, panelContentWidthValue } from '@holo-js/panels-react'
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { nextPanelAuthAppearanceVariables } from './auth-appearance'
import { useNextPanelAuthPresentation } from './auth-presentation'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PanelsIcon, Input, Label, NativeSelect } from './internal-ui'

export type NextPanelAuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'

export interface NextPanelAuthPageProps {
  readonly panelId: string
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
  if (type === 'mfa-challenge') return <><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-method`}>Verification method</Label><NativeSelect id={`${panelId}-method`} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></NativeSelect></div><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-code`}>Authentication code</Label><Input autoComplete="one-time-code" id={`${panelId}-code`} inputMode="numeric" name="code" required /></div></>
  if (type === 'password-reset-request') return <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-email`}>Email</Label><Input autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div>
  return <>
    {type === 'registration' ? <><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-name`}>Name</Label><Input autoComplete="name" id={`${panelId}-name`} name="name" required /></div><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-email`}>Email</Label><Input autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div></> : null}
    <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-password`}>Password</Label><Input autoComplete="new-password" id={`${panelId}-password`} name="password" type="password" required /></div>
    <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-password-confirmation`}>Confirm password</Label><Input autoComplete="new-password" id={`${panelId}-password-confirmation`} name="passwordConfirmation" type="password" required /></div>
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

export function NextPanelAuthPage({ panelId, type }: NextPanelAuthPageProps) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [title, description] = pageText[type]
  const presentation = useNextPanelAuthPresentation(panelId)

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

  if (!presentation) return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-holo-panel><Card className="hp-auth-card hp:h-80 hp:w-full hp:max-w-md hp:animate-pulse" /></main>
  const { appearance, brandName, loginPath, simplePageMaxContentWidth, theme } = presentation
  const style = { ...nextPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } as CSSProperties
  return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-density={appearance.density} data-holo-panel data-theme={theme} style={style}>
    <Card className="hp-auth-card hp:w-full hp:max-w-md">
      <CardHeader className="hp:space-y-2"><span className="hp:flex hp:size-10 hp:items-center hp:justify-center hp:rounded-md hp:bg-primary hp:text-primary-foreground"><PanelsIcon name={type === 'registration' ? 'user' : 'key'} /></span><div className="hp:space-y-1"><p className="hp:text-sm hp:font-medium hp:text-muted-foreground">{brandName}</p><CardTitle className="hp:text-2xl">{title}</CardTitle><CardDescription>{description}</CardDescription></div></CardHeader>
      <CardContent className="hp:space-y-4"><form className="hp:space-y-4" onSubmit={submit}>{fields(type, panelId)}{error ? <p className="hp:text-sm hp:text-destructive" role="alert">{error}</p> : null}{message ? <p className="hp:text-sm hp:text-muted-foreground" role="status">{message}</p> : null}<Button className="hp:w-full" disabled={pending} type="submit">{pending ? 'Please wait…' : type === 'email-verification' ? 'Resend verification email' : type === 'email-verification-verify' ? 'Verify email' : type === 'mfa-challenge' ? 'Verify' : 'Continue'}</Button></form>{loginPath ? <p className="hp:text-center hp:text-sm"><a className="hp:underline hp:underline-offset-4" href={loginPath}>Back to sign in</a></p> : null}</CardContent>
    </Card>
  </main>
}
