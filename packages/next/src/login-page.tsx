'use client'

import { createPanelTranslator, executePanelLogin, panelContentWidthValue, panelLoginErrorMessage, syncDocumentLocale } from '@holo-js/panels-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { nextPanelAuthAppearanceVariables } from './auth-appearance'
import { useNextPanelAuthPresentation } from './auth-presentation'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PanelsIcon, Input, Label } from './internal-ui'

export interface NextPanelLoginPageProps {
  readonly panelId: string
}

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export function NextPanelLoginPage({ panelId }: NextPanelLoginPageProps) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [locale, setLocale] = useState('en')
  const submitting = useRef(false)
  const presentation = useNextPanelAuthPresentation(panelId)
  const translate = useMemo(() => createPanelTranslator(locale), [locale])
  useEffect(() => setLocale(navigator.language), [])
  const direction = locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'
  useEffect(() => syncDocumentLocale({ direction, locale }, document), [direction, locale])

  async function login(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError('')
    setPending(true)
    try {
      const data = new FormData(event.currentTarget)
      const result = await executePanelLogin({
        credentials: { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') },
        csrfToken: cookie('XSRF-TOKEN'),
        panelId,
      })
      if (!result.ok || !result.url) {
        setError(panelLoginErrorMessage(result))
        return
      }
      globalThis.location.assign(result.url)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  if (!presentation) return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-holo-panel><Card className="hp-auth-card hp:h-80 hp:w-full hp:max-w-md hp:animate-pulse" /></main>
  const { appearance, brandName, forgotPasswordPath, registrationPath, simplePageMaxContentWidth, theme } = presentation
  const style = { ...nextPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } as CSSProperties
  return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-density={appearance.density} data-holo-panel data-theme={theme} dir={direction} lang={locale} style={style}>
    <Card className="hp-auth-card hp:w-full hp:max-w-md">
      <CardHeader className="hp:space-y-2"><span className="hp:flex hp:size-10 hp:items-center hp:justify-center hp:rounded-md hp:bg-primary hp:text-primary-foreground"><PanelsIcon name="key" /></span><div className="hp:space-y-1"><p className="hp:text-sm hp:font-medium hp:text-muted-foreground">{translate('auth.administration')}</p><CardTitle className="hp:text-2xl">{brandName}</CardTitle><CardDescription>{translate('auth.signInDescription')}</CardDescription></div></CardHeader>
      <CardContent className="hp:space-y-4">
        <form className="hp:space-y-4" onSubmit={login}>
          <div className="hp-auth-field hp:grid hp:gap-2"><Label htmlFor={`${panelId}-email`}>{translate('auth.email')}</Label><Input autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div>
          <div className="hp-auth-field hp:grid hp:gap-2"><div className="hp:flex hp:items-center hp:justify-between"><Label htmlFor={`${panelId}-password`}>{translate('auth.password')}</Label>{forgotPasswordPath ? <a className="hp:text-sm hp:underline hp:underline-offset-4" href={forgotPasswordPath}>{translate('auth.forgotPassword')}</a> : null}</div><Input autoComplete="current-password" id={`${panelId}-password`} name="password" type="password" required /></div>
          {error ? <p className="hp:text-sm hp:text-destructive" role="alert">{error}</p> : null}
          <Button className="hp:w-full" disabled={pending} type="submit">{pending ? translate('auth.signingIn') : translate('auth.signIn')}</Button>
        </form>
        {registrationPath ? <p className="hp:text-center hp:text-sm hp:text-muted-foreground">{translate('auth.needAccount')} <a className="hp:text-foreground hp:underline hp:underline-offset-4" href={registrationPath}>{translate('auth.register')}</a></p> : null}
      </CardContent>
    </Card>
  </main>
}
