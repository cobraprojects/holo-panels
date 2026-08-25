'use client'

import { executePanelAuthRequest, panelContentWidthValue } from '@holo-js/panels-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { nextPanelAuthAppearanceVariables } from './auth-appearance'
import { useNextPanelAuthPresentation } from './auth-presentation'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Card, CardContent, CardHeader, PanelsIcon, Input, Label, NativeSelect } from './internal-ui'

export interface NextPanelMultiFactorPageProps {
  readonly panelId: string
}

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export function NextPanelMultiFactorPage({ panelId }: NextPanelMultiFactorPageProps) {
  const [enabled, setEnabled] = useState(false)
  const [manualKey, setManualKey] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[]>([])
  const [error, setError] = useState('')
  const [disableRequest, setDisableRequest] = useState<{ readonly code: string, readonly method: 'recovery' | 'totp' } | null>(null)
  const presentation = useNextPanelAuthPresentation(panelId)
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

  async function regenerateRecoveryCodes(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const result = await request('mfa-recovery-codes-regenerate', { code: String(values.get('code') ?? ''), method: values.get('method') === 'recovery' ? 'recovery' : 'totp' })
    if (!result.ok) return setError('The multi-factor request could not be completed.')
    if (typeof result.data === 'object' && result.data !== null && 'recoveryCodes' in result.data && Array.isArray(result.data.recoveryCodes)) {
      setRecoveryCodes(result.data.recoveryCodes.map(String))
    }
  }

  function requestDisable(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setDisableRequest({ code: String(values.get('code') ?? ''), method: values.get('method') === 'recovery' ? 'recovery' : 'totp' })
  }

  async function disable(): Promise<void> {
    if (!disableRequest) return
    const result = await request('mfa-disable', disableRequest)
    setDisableRequest(null)
    if (!result.ok) return setError('The multi-factor request could not be completed.')
    setEnabled(false)
    setManualKey('')
    setRecoveryCodes([])
  }

  if (!presentation) return <main className="hp-auth-page" data-holo-panel><Card className="hp-auth-card hp:h-80 hp:animate-pulse" /></main>
  const { appearance, brandName, simplePageMaxContentWidth, theme } = presentation
  const style = { ...nextPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } as CSSProperties
  return <main className="hp-auth-page" data-density={appearance.density} data-holo-panel data-theme={theme} style={style}><Card className="hp-auth-card"><CardHeader><span className="hp-auth-brand-mark"><PanelsIcon name="key" /></span><div><p>{brandName}</p><h1>Multi-factor authentication</h1><span>MFA is {enabled ? 'enabled' : 'disabled'}.</span></div></CardHeader><CardContent>
    {!enabled && !manualKey ? <Button className="hp-button hp-button-primary" onClick={() => void begin()}>Begin enrollment</Button> : null}
    {manualKey ? <><p>Manual key: <code>{manualKey}</code></p><form onSubmit={confirm}><div className="hp-auth-field"><Label htmlFor={`${panelId}-confirm-code`}>Authentication code</Label><Input autoComplete="one-time-code" id={`${panelId}-confirm-code`} name="code" required /></div><Button className="hp-button hp-button-primary" type="submit">Confirm enrollment</Button></form></> : null}
    {recoveryCodes.length ? <section aria-label="Recovery codes"><h2>Recovery codes</h2><ul>{recoveryCodes.map(code => <li key={code}><code>{code}</code></li>)}</ul></section> : null}
    {enabled ? <form onSubmit={regenerateRecoveryCodes}><div className="hp-auth-field"><Label htmlFor={`${panelId}-regenerate-method`}>Verification method</Label><NativeSelect id={`${panelId}-regenerate-method`} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></NativeSelect></div><div className="hp-auth-field"><Label htmlFor={`${panelId}-regenerate-code`}>Code</Label><Input id={`${panelId}-regenerate-code`} name="code" required /></div><Button className="hp-button" type="submit">Regenerate recovery codes</Button></form> : null}
    {enabled ? <form onSubmit={requestDisable}><div className="hp-auth-field"><Label htmlFor={`${panelId}-disable-method`}>Verification method</Label><NativeSelect id={`${panelId}-disable-method`} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></NativeSelect></div><div className="hp-auth-field"><Label htmlFor={`${panelId}-disable-code`}>Code</Label><Input id={`${panelId}-disable-code`} name="code" required /></div><Button className="hp-button hp-button-destructive" type="submit" variant="destructive"><PanelsIcon name="delete" />Disable multi-factor authentication</Button></form> : null}
    {error ? <p className="hp-auth-error" role="alert">{error}</p> : null}
  </CardContent></Card><AlertDialog onOpenChange={open => { if (!open) setDisableRequest(null) }} open={disableRequest !== null}><AlertDialogContent data-holo-panel><AlertDialogHeader><AlertDialogTitle>Disable multi-factor authentication?</AlertDialogTitle><AlertDialogDescription>Your account will no longer require a second authentication factor.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void disable()} variant="destructive"><PanelsIcon name="delete" />Disable</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></main>
}
