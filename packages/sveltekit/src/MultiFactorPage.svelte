<script lang="ts">
  import { executePanelAuthRequest, panelContentWidthValue, panelThemeStyleAttribute, type PanelClientAuthOperation } from '@holo-js/panels-svelte'
  import { onMount } from 'svelte'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import Input from './Input.svelte'

  interface Props {
    brandName: string
    panelId: string
    simplePageMaxContentWidth?: string
    theme?: 'dark' | 'light' | 'system'
    themeColors?: Readonly<Record<string, string>>
  }

  let { brandName, panelId, simplePageMaxContentWidth, theme = 'system', themeColors }: Props = $props()
  let enabled = $state(false)
  let manualKey = $state('')
  let recoveryCodes = $state<readonly string[]>([])
  let code = $state('')
  let method = $state<'recovery' | 'totp'>('totp')
  let error = $state('')

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  const request = (operation: PanelClientAuthOperation, payload: Readonly<Record<string, unknown>> = {}) => executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId, payload })

  onMount(() => {
    void request('mfa-status').then((result) => {
      if (result.ok && typeof result.data === 'object' && result.data !== null && 'enabled' in result.data) enabled = result.data.enabled === true
    })
  })

  async function begin(): Promise<void> {
    const result = await request('mfa-enrollment-begin')
    if (!result.ok || typeof result.data !== 'object' || result.data === null || !('manualKey' in result.data)) error = 'Multi-factor enrollment could not be started.'
    else manualKey = String(result.data.manualKey)
  }

  async function confirm(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!(event.currentTarget instanceof HTMLFormElement)) return
    const values = new FormData(event.currentTarget)
    const result = await request('mfa-enrollment-confirm', { code: String(values.get('code') ?? '') })
    if (!result.ok || typeof result.data !== 'object' || result.data === null || !('recoveryCodes' in result.data) || !Array.isArray(result.data.recoveryCodes)) error = 'Multi-factor enrollment could not be confirmed.'
    else {
      recoveryCodes = result.data.recoveryCodes.map(String)
      enabled = true
    }
  }

  async function protectedAction(event: SubmitEvent, operation: 'mfa-disable' | 'mfa-recovery-codes-regenerate'): Promise<void> {
    event.preventDefault()
    if (!(event.currentTarget instanceof HTMLFormElement)) return
    const values = new FormData(event.currentTarget)
    const result = await request(operation, { code: String(values.get('code') ?? ''), method: values.get('method') === 'recovery' ? 'recovery' : 'totp' })
    if (!result.ok) error = 'The multi-factor request could not be completed.'
    else if (operation === 'mfa-disable') {
      enabled = false
      manualKey = ''
      recoveryCodes = []
    } else if (typeof result.data === 'object' && result.data !== null && 'recoveryCodes' in result.data && Array.isArray(result.data.recoveryCodes)) recoveryCodes = result.data.recoveryCodes.map(String)
  }
</script>

<main class="hp-auth-page" data-holo-panel data-theme={theme} style={`${panelThemeStyleAttribute({ colors: themeColors })}${simplePageMaxContentWidth ? `--hp-auth-max-width:${panelContentWidthValue(simplePageMaxContentWidth)};` : ''}`}>
  <section class="hp-auth-card" data-slot="card">
    <div data-slot="card-header"><span class="hp-auth-brand-mark"><Icon name="key" /></span><div><p>{brandName}</p><h1>Multi-factor authentication</h1><span>MFA is {enabled ? 'enabled' : 'disabled'}.</span></div></div>
    <div data-slot="card-content">
      {#if !enabled && !manualKey}<Button class="hp-button hp-button-primary" onclick={() => void begin()}>Begin enrollment</Button>{/if}
      {#if manualKey}<section><p>Manual key: <code>{manualKey}</code></p><form onsubmit={confirm}><div class="hp-auth-field"><label data-slot="label" for={`${panelId}-confirm-code`}>Authentication code</label><Input id={`${panelId}-confirm-code`} name="code" bind:value={code} required /></div><Button class="hp-button hp-button-primary" type="submit">Confirm enrollment</Button></form></section>{/if}
      {#if recoveryCodes.length}<section aria-label="Recovery codes"><h2>Recovery codes</h2><ul>{#each recoveryCodes as recoveryCode}<li><code>{recoveryCode}</code></li>{/each}</ul></section>{/if}
      {#if enabled}<form onsubmit={(event) => protectedAction(event, 'mfa-recovery-codes-regenerate')}><div class="hp-auth-field"><label data-slot="label" for={`${panelId}-regenerate-method`}>Verification method</label><select data-slot="native-select" id={`${panelId}-regenerate-method`} name="method" bind:value={method}><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></div><div class="hp-auth-field"><label data-slot="label" for={`${panelId}-regenerate-code`}>Authentication code</label><Input id={`${panelId}-regenerate-code`} name="code" bind:value={code} required /></div><Button class="hp-button" type="submit">Regenerate recovery codes</Button></form>{/if}
      {#if enabled}<form onsubmit={(event) => protectedAction(event, 'mfa-disable')}><div class="hp-auth-field"><label data-slot="label" for={`${panelId}-disable-method`}>Verification method</label><select data-slot="native-select" id={`${panelId}-disable-method`} name="method" bind:value={method}><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></div><div class="hp-auth-field"><label data-slot="label" for={`${panelId}-disable-code`}>Authentication code</label><Input id={`${panelId}-disable-code`} name="code" bind:value={code} required /></div><Button class="hp-button hp-button-destructive" type="submit">Disable multi-factor authentication</Button></form>{/if}
      {#if error}<p class="hp-auth-error" role="alert">{error}</p>{/if}
    </div>
  </section>
</main>
