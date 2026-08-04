<script lang="ts">
  import { onMount } from 'svelte'

  let enabled = false
  let manualKey = ''
  let recoveryCodes: readonly string[] = []
  let enrollmentCode = ''
  let disableCode = ''
  let disableMethod: 'recovery' | 'totp' = 'totp'
  let error = ''

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

  onMount(async () => {
    const response = await authRequest('mfa-status')
    if (response.ok) enabled = Boolean((await response.json() as { enabled?: unknown }).enabled)
  })

  async function begin(): Promise<void> {
    const response = await authRequest('mfa-enrollment-begin')
    if (!response.ok) return void (error = 'MFA enrollment failed')
    manualKey = String((await response.json() as { manualKey?: unknown }).manualKey ?? '')
  }

  async function confirm(): Promise<void> {
    const response = await authRequest('mfa-enrollment-confirm', { code: enrollmentCode })
    if (!response.ok) return void (error = 'MFA confirmation failed')
    const result = await response.json() as { recoveryCodes?: unknown }
    recoveryCodes = Array.isArray(result.recoveryCodes) ? result.recoveryCodes.map(String) : []
    enabled = true
  }

  async function disable(): Promise<void> {
    const response = await authRequest('mfa-disable', { code: disableCode, method: disableMethod })
    if (!response.ok) return void (error = 'MFA disable failed')
    enabled = false
    manualKey = ''
    recoveryCodes = []
  }
</script>

<main><h1>Multi-factor authentication</h1><p>MFA is {enabled ? 'enabled' : 'disabled'}.</p>{#if !enabled && !manualKey}<button type="button" onclick={begin}>Begin enrollment</button>{/if}{#if manualKey}<p>Manual key: <code data-testid="mfa-manual-key">{manualKey}</code></p><form onsubmit={(event) => { event.preventDefault(); void confirm() }}><label>Authentication code<input bind:value={enrollmentCode} name="code" inputmode="numeric" required></label><button type="submit">Confirm enrollment</button></form>{/if}{#if recoveryCodes.length}<section aria-label="Recovery codes"><h2>Recovery codes</h2><ul>{#each recoveryCodes as code (code)}<li>{code}</li>{/each}</ul></section>{/if}{#if enabled}<form onsubmit={(event) => { event.preventDefault(); void disable() }}><label>Disable method<select bind:value={disableMethod} name="method"><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></label><label>Disable code<input bind:value={disableCode} name="code" required></label><button type="submit">Disable MFA</button></form>{/if}{#if error}<p role="alert">{error}</p>{/if}</main>
