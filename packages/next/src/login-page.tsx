'use client'

import { executePanelLogin, panelContentWidthValue } from '@holo-js/panels-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { nextPanelAuthAppearanceVariables, type NextPanelAuthAppearance } from './auth-appearance'
import { ShadcnButton, ShadcnCard, ShadcnCardContent, ShadcnCardHeader, ShadcnIcon, ShadcnInput, ShadcnLabel } from './internal-ui'

export interface NextPanelLoginPageProps {
  readonly appearance?: NextPanelAuthAppearance
  readonly brandName: string
  readonly forgotPasswordPath?: string
  readonly panelId: string
  readonly registrationPath?: string
  readonly simplePageMaxContentWidth?: string
  readonly theme?: 'dark' | 'light' | 'system'
  readonly themeColors?: Readonly<Record<string, string>>
}

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export function NextPanelLoginPage({ appearance, brandName, forgotPasswordPath, panelId, registrationPath, simplePageMaxContentWidth, theme = 'system', themeColors }: NextPanelLoginPageProps) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function login(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
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
        setError('These credentials do not match our records.')
        return
      }
      globalThis.location.assign(result.url)
    } finally {
      setPending(false)
    }
  }

  const style = { ...nextPanelAuthAppearanceVariables(appearance, themeColors), ...(simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } : {}) } as CSSProperties
  return <main className="hp-auth-page" data-density={appearance?.density} data-holo-panel data-theme={theme} style={style}>
    <ShadcnCard className="hp-auth-card">
      <ShadcnCardHeader><span className="hp-auth-brand-mark"><ShadcnIcon name="key" /></span><div><p>Administration</p><h1>{brandName}</h1><span>Sign in to your account</span></div></ShadcnCardHeader>
      <ShadcnCardContent>
        <form onSubmit={login}>
          <div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-email`}>Email</ShadcnLabel><ShadcnInput autoComplete="email" id={`${panelId}-email`} name="email" type="email" required /></div>
          <div className="hp-auth-field"><div className="hp-auth-field-heading"><ShadcnLabel htmlFor={`${panelId}-password`}>Password</ShadcnLabel>{forgotPasswordPath ? <a href={forgotPasswordPath}>Forgot password?</a> : null}</div><ShadcnInput autoComplete="current-password" id={`${panelId}-password`} name="password" type="password" required /></div>
          {error ? <p className="hp-auth-error" role="alert">{error}</p> : null}
          <ShadcnButton className="hp-button hp-button-primary" disabled={pending} type="submit">{pending ? 'Signing in…' : 'Sign in'}</ShadcnButton>
        </form>
        {registrationPath ? <p className="hp-auth-footer">Need an account? <a href={registrationPath}>Register</a></p> : null}
      </ShadcnCardContent>
    </ShadcnCard>
  </main>
}
