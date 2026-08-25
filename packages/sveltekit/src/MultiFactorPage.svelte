<script lang="ts">
  import { executePanelAuthRequest, loadPanelAuthPresentation, panelContentWidthValue, type PanelAuthPresentation, type PanelClientAuthOperation } from '@holo-js/panels-svelte'
  import { onMount } from 'svelte'
  import { svelteKitPanelAuthAppearanceStyleAttribute } from './auth-appearance'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import * as AlertDialog from '@holo-js/panels-svelte/ui/alert-dialog'
  import { Alert, AlertDescription } from '@holo-js/panels-svelte/ui/alert'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@holo-js/panels-svelte/ui/card'
  import { Field, FieldLabel } from '@holo-js/panels-svelte/ui/field'
  import Icon from './Icon.svelte'
  import { Input } from '@holo-js/panels-svelte/ui/input'
  import { NativeSelect, NativeSelectOption } from '@holo-js/panels-svelte/ui/native-select'

  interface Props {
    panelId: string
  }

  let { panelId }: Props = $props()
  let presentation = $state<PanelAuthPresentation | null>(null)
  let enabled = $state(false)
  let manualKey = $state('')
  let recoveryCodes = $state<readonly string[]>([])
  let code = $state('')
  let method = $state<'recovery' | 'totp'>('totp')
  let error = $state('')
  let disableConfirmation = $state(false)

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  const request = (operation: PanelClientAuthOperation, payload: Readonly<Record<string, unknown>> = {}) => executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId, payload })

  onMount(() => {
    void loadPanelAuthPresentation(panelId).then(value => { presentation = value })
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

  async function regenerateRecoveryCodes(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!(event.currentTarget instanceof HTMLFormElement)) return
    const values = new FormData(event.currentTarget)
    const result = await request('mfa-recovery-codes-regenerate', { code: String(values.get('code') ?? ''), method: values.get('method') === 'recovery' ? 'recovery' : 'totp' })
    if (!result.ok) error = 'The multi-factor request could not be completed.'
    else if (typeof result.data === 'object' && result.data !== null && 'recoveryCodes' in result.data && Array.isArray(result.data.recoveryCodes)) recoveryCodes = result.data.recoveryCodes.map(String)
  }

  function requestDisable(event: SubmitEvent): void {
    event.preventDefault()
    disableConfirmation = true
  }

  async function disable(): Promise<void> {
    const result = await request('mfa-disable', { code, method })
    disableConfirmation = false
    if (!result.ok) {
      error = 'The multi-factor request could not be completed.'
      return
    }
    enabled = false
    manualKey = ''
    recoveryCodes = []
  }
</script>

{#if presentation}
<main class="hp-auth-page" data-density={presentation.appearance.density} data-holo-panel data-theme={presentation.theme} style={`${svelteKitPanelAuthAppearanceStyleAttribute(presentation.appearance)}--hp-auth-max-width:${panelContentWidthValue(presentation.simplePageMaxContentWidth)};`}>
  <Card class="hp-auth-card hp:w-full hp:max-w-lg">
    <CardHeader><span class="hp-auth-brand-mark"><Icon name="key" /></span><CardDescription>{presentation.brandName}</CardDescription><CardTitle>Multi-factor authentication</CardTitle><CardDescription>MFA is {enabled ? 'enabled' : 'disabled'}.</CardDescription></CardHeader>
    <CardContent class="hp:space-y-6">
      {#if !enabled && !manualKey}<Button onclick={() => void begin()}>Begin enrollment</Button>{/if}
      {#if manualKey}<section class="hp:space-y-4"><p class="hp:text-sm">Manual key: <code>{manualKey}</code></p><form class="hp:space-y-4" onsubmit={confirm}><Field><FieldLabel for={`${panelId}-confirm-code`}>Authentication code</FieldLabel><Input id={`${panelId}-confirm-code`} name="code" bind:value={code} required /></Field><Button type="submit">Confirm enrollment</Button></form></section>{/if}
      {#if recoveryCodes.length}<section aria-label="Recovery codes"><h2>Recovery codes</h2><ul>{#each recoveryCodes as recoveryCode}<li><code>{recoveryCode}</code></li>{/each}</ul></section>{/if}
      {#if enabled}<form class="hp:space-y-4" onsubmit={regenerateRecoveryCodes}><Field><FieldLabel for={`${panelId}-regenerate-method`}>Verification method</FieldLabel><NativeSelect id={`${panelId}-regenerate-method`} name="method" bind:value={method}><NativeSelectOption value="totp">Authenticator code</NativeSelectOption><NativeSelectOption value="recovery">Recovery code</NativeSelectOption></NativeSelect></Field><Field><FieldLabel for={`${panelId}-regenerate-code`}>Authentication code</FieldLabel><Input id={`${panelId}-regenerate-code`} name="code" bind:value={code} required /></Field><Button variant="outline" type="submit">Regenerate recovery codes</Button></form>{/if}
      {#if enabled}<form class="hp:space-y-4" onsubmit={requestDisable}><Field><FieldLabel for={`${panelId}-disable-method`}>Verification method</FieldLabel><NativeSelect id={`${panelId}-disable-method`} name="method" bind:value={method}><NativeSelectOption value="totp">Authenticator code</NativeSelectOption><NativeSelectOption value="recovery">Recovery code</NativeSelectOption></NativeSelect></Field><Field><FieldLabel for={`${panelId}-disable-code`}>Authentication code</FieldLabel><Input id={`${panelId}-disable-code`} name="code" bind:value={code} required /></Field><Button variant="destructive" type="submit">Disable multi-factor authentication</Button></form>{/if}
      {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
    </CardContent>
  </Card>
</main>
{:else}
<main class="hp-auth-page" data-holo-panel><Card class="hp-auth-card hp:h-80 hp:animate-pulse" /></main>
{/if}

<AlertDialog.Root open={disableConfirmation} onOpenChange={(open) => { disableConfirmation = open }}>
  <AlertDialog.Content data-holo-panel><AlertDialog.Header><AlertDialog.Title>Disable multi-factor authentication?</AlertDialog.Title><AlertDialog.Description>Your account will no longer require a second authentication factor.</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel>Cancel</AlertDialog.Cancel><AlertDialog.Action variant="destructive" onclick={() => void disable()}>Disable</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content>
</AlertDialog.Root>
