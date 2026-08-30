'use client'

import { createPanelTranslator, executePanelAuthRequest, panelContentWidthValue, syncDocumentLocale, type PanelTranslationKey } from '@holo-js/panels-react'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { nextPanelAuthAppearanceVariables } from './auth-appearance'
import { useNextPanelAuthPresentation } from './auth-presentation'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PanelsIcon, Input, Label, NativeSelect } from './internal-ui'

export type NextPanelAuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'

export interface NextPanelAuthPageProps {
  readonly panelId: string
  readonly type: NextPanelAuthPageType
}

const pageText: Readonly<Record<NextPanelAuthPageType, readonly [PanelTranslationKey, PanelTranslationKey]>> = Object.freeze({
  'email-verification': ['auth.verifyEmail', 'auth.emailVerificationDescription'],
  'email-verification-verify': ['auth.verifyEmail', 'auth.emailVerificationLinkDescription'],
  'mfa-challenge': ['auth.twoFactorAuthentication', 'auth.mfaChallengeDescription'],
  'password-reset': ['auth.resetPassword', 'auth.resetPasswordDescription'],
  'password-reset-request': ['auth.forgotPasswordTitle', 'auth.forgotPasswordDescription'],
  registration: ['auth.createAccount', 'auth.createAccountDescription'],
})

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function fields(type: NextPanelAuthPageType, panelId: string, translate: ReturnType<typeof createPanelTranslator>): ReactNode {
  if (type === 'email-verification' || type === 'email-verification-verify') return null
  if (type === 'mfa-challenge') return <><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-method`}>{translate('auth.verificationMethod')}</Label><NativeSelect id={`${panelId}-method`} name="method"><option value="totp">{translate('auth.authenticatorCode')}</option><option value="recovery">{translate('auth.recoveryCode')}</option></NativeSelect></div><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-code`}>{translate('auth.authenticationCode')}</Label><Input autoComplete="one-time-code" id={`${panelId}-code`} inputMode="numeric" name="code" required /></div></>
  if (type === 'password-reset-request') return <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-email`}>{translate('auth.email')}</Label><Input autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div>
  return <>
    {type === 'registration' ? <><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-name`}>{translate('auth.name')}</Label><Input autoComplete="name" id={`${panelId}-name`} name="name" required /></div><div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-email`}>{translate('auth.email')}</Label><Input autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div></> : null}
    <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-password`}>{translate('auth.password')}</Label><Input autoComplete="new-password" id={`${panelId}-password`} name="password" type="password" required /></div>
    <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-password-confirmation`}>{translate('auth.confirmPassword')}</Label><Input autoComplete="new-password" id={`${panelId}-password-confirmation`} name="passwordConfirmation" type="password" required /></div>
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
  const [locale, setLocale] = useState('en')
  const translate = useMemo(() => createPanelTranslator(locale), [locale])
  const direction = locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'
  const [titleKey, descriptionKey] = pageText[type]
  const presentation = useNextPanelAuthPresentation(panelId)
  useEffect(() => setLocale(navigator.language), [])
  useEffect(() => syncDocumentLocale({ direction, locale }, document), [direction, locale])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setMessage('')
    setPending(true)
    try {
      const authRequest = request(type, new FormData(event.currentTarget))
      const result = await executePanelAuthRequest({ ...authRequest, csrfToken: cookie('XSRF-TOKEN'), panelId })
      if (!result.ok) {
        setError(translate('auth.requestFailed'))
        return
      }
      if (result.url) {
        location.assign(result.url)
        return
      }
      setMessage(translate(type === 'password-reset-request' || type === 'email-verification' ? 'auth.emailSent' : 'auth.changesSaved'))
    } finally {
      setPending(false)
    }
  }

  if (!presentation) return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-holo-panel><Card className="hp-auth-card hp:h-80 hp:w-full hp:max-w-md hp:animate-pulse" /></main>
  const { appearance, brandName, loginPath, simplePageMaxContentWidth, theme } = presentation
  const style = { ...nextPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } as CSSProperties
  return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-density={appearance.density} data-holo-panel data-theme={theme} dir={direction} lang={locale} style={style}>
    <Card className="hp-auth-card hp:w-full hp:max-w-md">
      <CardHeader className="hp:space-y-2"><span className="hp:flex hp:size-10 hp:items-center hp:justify-center hp:rounded-md hp:bg-primary hp:text-primary-foreground"><PanelsIcon name={type === 'registration' ? 'user' : 'key'} /></span><div className="hp:space-y-1"><p className="hp:text-sm hp:font-medium hp:text-muted-foreground">{brandName}</p><CardTitle className="hp:text-2xl">{translate(titleKey)}</CardTitle><CardDescription>{translate(descriptionKey)}</CardDescription></div></CardHeader>
      <CardContent className="hp:space-y-4"><form className="hp:space-y-4" onSubmit={submit}>{fields(type, panelId, translate)}{error ? <p className="hp:text-sm hp:text-destructive" role="alert">{error}</p> : null}{message ? <p className="hp:text-sm hp:text-muted-foreground" role="status">{message}</p> : null}<Button className="hp:w-full" disabled={pending} type="submit">{translate(pending ? 'states.loading' : type === 'email-verification' ? 'auth.resendVerificationEmail' : type === 'email-verification-verify' ? 'auth.verifyEmailAction' : type === 'mfa-challenge' ? 'auth.verify' : 'auth.continue')}</Button></form>{loginPath ? <p className="hp:text-center hp:text-sm"><a className="hp:underline hp:underline-offset-4" href={loginPath}>{translate('auth.backToSignIn')}</a></p> : null}</CardContent>
    </Card>
  </main>
}
