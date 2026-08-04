'use client'

import { useState, type FormEvent } from 'react'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export default function MultiFactorChallengePage() {
  const [error, setError] = useState('')

  async function challenge(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const method = values.get('method') === 'recovery' ? 'recovery' : 'challenge'
    const response = await fetch(`/_holo/panels/admin/auth/mfa-${method}`, {
      body: JSON.stringify({ code: values.get('code') }),
      headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
      method: 'POST',
    })
    if (!response.ok) return setError('MFA challenge failed')
    window.location.assign(response.url)
  }

  return <main><h1>MFA challenge</h1><form onSubmit={challenge}><label>Challenge method<select name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></label><label>Authentication code<input name="code" required /></label><button type="submit">Verify</button>{error ? <p role="alert">{error}</p> : null}</form></main>
}
