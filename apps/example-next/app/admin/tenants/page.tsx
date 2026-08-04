'use client'

import { useState, type FormEvent } from 'react'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export default function TenantPage() {
  const [error, setError] = useState('')
  const [active, setActive] = useState('')

  async function switchTenant(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const routeKey = String(new FormData(event.currentTarget).get('tenant') ?? '')
    const response = await fetch('/_holo/panels/admin/tenant/switch', {
      body: JSON.stringify({ routeKey }),
      headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
      method: 'POST',
    })
    if (!response.ok) return setError('Tenant switch failed')
    const result = await response.json() as { tenant?: { routeKey?: unknown } }
    setActive(String(result.tenant?.routeKey ?? ''))
  }

  return <main><h1>Switch tenant</h1><form onSubmit={switchTenant}><label>Tenant<select name="tenant"><option value="acme">Acme</option><option value="globex">Globex</option></select></label><button type="submit">Switch tenant</button>{active ? <p>Active tenant: {active}</p> : null}{error ? <p role="alert">{error}</p> : null}</form></main>
}
