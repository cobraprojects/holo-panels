'use client'

import { useState, type FormEvent } from 'react'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export default function LoginPage() {
  const [error, setError] = useState('')

  async function login(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    const fields = new FormData(event.currentTarget)
    const response = await fetch('/_holo/panels/admin/auth/login', {
      body: JSON.stringify({ credentials: { email: fields.get('email'), password: fields.get('password') } }),
      headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('XSRF-TOKEN') },
      method: 'POST',
    })
    if (!response.ok) {
      setError('Login failed')
      return
    }
    window.location.assign(response.url)
  }

  return <main><h1>Panel login</h1><form onSubmit={login}><label>Email<input name="email" type="email" defaultValue="super@example.test" required /></label><label>Password<input name="password" type="password" defaultValue="panel-secret" required /></label><button type="submit">Log in</button>{error ? <p role="alert">{error}</p> : null}</form></main>
}
