'use client'

import { useEffect, useState, type FormEvent } from 'react'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

async function authRequest(operation: string, payload?: object): Promise<Response> {
  return fetch(`/_holo/panels/admin/auth/${operation}`, payload ? {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
    method: 'POST',
  } : { method: 'GET' })
}

export default function MultiFactorPage() {
  const [enabled, setEnabled] = useState(false)
  const [manualKey, setManualKey] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void authRequest('mfa-status').then(async response => {
      if (response.ok) setEnabled(Boolean((await response.json() as { enabled?: unknown }).enabled))
    })
  }, [])

  async function begin(): Promise<void> {
    const response = await authRequest('mfa-enrollment-begin')
    if (!response.ok) return setError('MFA enrollment failed')
    setManualKey(String((await response.json() as { manualKey?: unknown }).manualKey ?? ''))
  }

  async function confirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code') ?? '')
    const response = await authRequest('mfa-enrollment-confirm', { code })
    if (!response.ok) return setError('MFA confirmation failed')
    const result = await response.json() as { recoveryCodes?: unknown }
    setRecoveryCodes(Array.isArray(result.recoveryCodes) ? result.recoveryCodes.map(String) : [])
    setEnabled(true)
  }

  async function disable(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const response = await authRequest('mfa-disable', { code: values.get('code'), method: values.get('method') })
    if (!response.ok) return setError('MFA disable failed')
    setEnabled(false)
    setManualKey('')
    setRecoveryCodes([])
  }

  return <main><h1>Multi-factor authentication</h1><p>MFA is {enabled ? 'enabled' : 'disabled'}.</p>{!enabled && !manualKey ? <button type="button" onClick={begin}>Begin enrollment</button> : null}{manualKey ? <><p>Manual key: <code data-testid="mfa-manual-key">{manualKey}</code></p><form onSubmit={confirm}><label>Authentication code<input name="code" inputMode="numeric" required /></label><button type="submit">Confirm enrollment</button></form></> : null}{recoveryCodes.length ? <section aria-label="Recovery codes"><h2>Recovery codes</h2><ul>{recoveryCodes.map(code => <li key={code}>{code}</li>)}</ul></section> : null}{enabled ? <form onSubmit={disable}><label>Disable method<select name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></label><label>Disable code<input name="code" required /></label><button type="submit">Disable MFA</button></form> : null}{error ? <p role="alert">{error}</p> : null}</main>
}
