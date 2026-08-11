'use client'

import { executePanelAuthRequest, panelContentWidthValue, panelThemeVariables } from '@holo-js/panels-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { ShadcnButton, ShadcnCard, ShadcnCardContent, ShadcnCardHeader, ShadcnIcon, ShadcnInput, ShadcnLabel, ShadcnSelect } from './internal-ui'

export interface NextPanelMultiFactorPageProps {
  readonly brandName: string
  readonly panelId: string
  readonly simplePageMaxContentWidth?: string
  readonly theme?: 'dark' | 'light' | 'system'
  readonly themeColors?: Readonly<Record<string, string>>
}

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export function NextPanelMultiFactorPage({ brandName, panelId, simplePageMaxContentWidth, theme = 'system', themeColors }: NextPanelMultiFactorPageProps) {
  const [enabled, setEnabled] = useState(false)
  const [manualKey, setManualKey] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[]>([])
  const [error, setError] = useState('')
  const style = { ...panelThemeVariables({ colors: themeColors }), ...(simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } : {}) } as CSSProperties
  const request = (operation: Parameters<typeof executePanelAuthRequest>[0]['operation'], payload: Readonly<Record<string, unknown>> = {}) => executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId, payload })

  useEffect(() => {
    void request('mfa-status').then((result) => {
      if (result.ok && typeof result.data === 'object' && result.data !== null && 'enabled' in result.data) setEnabled(result.data.enabled === true)
    })
  }, [])

  async function begin(): Promise<void> {
    const result = await request('mfa-enrollment-begin')
    if (!result.ok || typeof result.data !== 'object' || result.data === null || !('manualKey' in result.data)) return setError('Multi-factor enrollment could not be started.')
    setManualKey(String(result.data.manualKey))
  }

  async function confirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const result = await request('mfa-enrollment-confirm', { code: String(new FormData(event.currentTarget).get('code') ?? '') })
    if (!result.ok || typeof result.data !== 'object' || result.data === null || !('recoveryCodes' in result.data) || !Array.isArray(result.data.recoveryCodes)) return setError('Multi-factor enrollment could not be confirmed.')
    setRecoveryCodes(result.data.recoveryCodes.map(String))
    setEnabled(true)
  }

  async function protectedAction(event: FormEvent<HTMLFormElement>, operation: 'mfa-disable' | 'mfa-recovery-codes-regenerate'): Promise<void> {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const result = await request(operation, { code: String(values.get('code') ?? ''), method: values.get('method') === 'recovery' ? 'recovery' : 'totp' })
    if (!result.ok) return setError('The multi-factor request could not be completed.')
    if (operation === 'mfa-disable') {
      setEnabled(false)
      setManualKey('')
      setRecoveryCodes([])
    } else if (typeof result.data === 'object' && result.data !== null && 'recoveryCodes' in result.data && Array.isArray(result.data.recoveryCodes)) {
      setRecoveryCodes(result.data.recoveryCodes.map(String))
    }
  }

  return <main className="hp-auth-page" data-holo-panel data-theme={theme} style={style}><ShadcnCard className="hp-auth-card"><ShadcnCardHeader><span className="hp-auth-brand-mark"><ShadcnIcon name="key" /></span><div><p>{brandName}</p><h1>Multi-factor authentication</h1><span>MFA is {enabled ? 'enabled' : 'disabled'}.</span></div></ShadcnCardHeader><ShadcnCardContent>
    {!enabled && !manualKey ? <ShadcnButton className="hp-button hp-button-primary" onClick={() => void begin()}>Begin enrollment</ShadcnButton> : null}
    {manualKey ? <><p>Manual key: <code>{manualKey}</code></p><form onSubmit={confirm}><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-confirm-code`}>Authentication code</ShadcnLabel><ShadcnInput autoComplete="one-time-code" id={`${panelId}-confirm-code`} name="code" required /></div><ShadcnButton className="hp-button hp-button-primary" type="submit">Confirm enrollment</ShadcnButton></form></> : null}
    {recoveryCodes.length ? <section aria-label="Recovery codes"><h2>Recovery codes</h2><ul>{recoveryCodes.map(code => <li key={code}><code>{code}</code></li>)}</ul></section> : null}
    {enabled ? <form onSubmit={event => void protectedAction(event, 'mfa-recovery-codes-regenerate')}><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-regenerate-method`}>Verification method</ShadcnLabel><ShadcnSelect id={`${panelId}-regenerate-method`} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></ShadcnSelect></div><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-regenerate-code`}>Code</ShadcnLabel><ShadcnInput id={`${panelId}-regenerate-code`} name="code" required /></div><ShadcnButton className="hp-button" type="submit">Regenerate recovery codes</ShadcnButton></form> : null}
    {enabled ? <form onSubmit={event => void protectedAction(event, 'mfa-disable')}><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-disable-method`}>Verification method</ShadcnLabel><ShadcnSelect id={`${panelId}-disable-method`} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></ShadcnSelect></div><div className="hp-auth-field"><ShadcnLabel htmlFor={`${panelId}-disable-code`}>Code</ShadcnLabel><ShadcnInput id={`${panelId}-disable-code`} name="code" required /></div><ShadcnButton className="hp-button hp-button-destructive" type="submit">Disable multi-factor authentication</ShadcnButton></form> : null}
    {error ? <p className="hp-auth-error" role="alert">{error}</p> : null}
  </ShadcnCardContent></ShadcnCard></main>
}
