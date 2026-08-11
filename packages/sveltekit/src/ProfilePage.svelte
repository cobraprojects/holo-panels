<script lang="ts">
  import { executePanelAuthRequest, panelContentWidthValue, panelThemeStyleAttribute } from '@holo-js/panels-svelte'
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
  let values = $state<Readonly<Record<string, unknown>>>({})
  let error = $state('')
  let saved = $state(false)

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  function label(field: string): string {
    return field.replaceAll('_', ' ').replace(/\b\w/gu, letter => letter.toUpperCase())
  }

  function inputType(field: string, value: unknown): 'checkbox' | 'email' | 'number' | 'text' {
    if (typeof value === 'boolean') return 'checkbox'
    if (typeof value === 'number') return 'number'
    return field === 'email' ? 'email' : 'text'
  }

  onMount(() => {
    void executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-read', panelId, payload: {} }).then((result) => {
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('values' in result.data) || typeof result.data.values !== 'object' || result.data.values === null || Array.isArray(result.data.values)) error = 'The profile could not be loaded.'
      else values = result.data.values as Readonly<Record<string, unknown>>
    })
  })

  function update(field: string, current: unknown, input: HTMLInputElement): void {
    values = { ...values, [field]: typeof current === 'boolean' ? input.checked : typeof current === 'number' ? input.valueAsNumber : input.value }
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    error = ''
    saved = false
    const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-update', panelId, payload: { values } })
    if (!result.ok) error = 'The profile could not be saved.'
    else saved = true
  }
</script>

<main class="hp-auth-page" data-holo-panel data-theme={theme} style={`${panelThemeStyleAttribute({ colors: themeColors })}${simplePageMaxContentWidth ? `--hp-auth-max-width:${panelContentWidthValue(simplePageMaxContentWidth)};` : ''}`}>
  <section class="hp-auth-card" data-slot="card">
    <div data-slot="card-header"><span class="hp-auth-brand-mark"><Icon name="user" /></span><div><p>{brandName}</p><h1>Profile</h1><span>Manage your account information.</span></div></div>
    <div data-slot="card-content"><form onsubmit={save}>{#each Object.entries(values) as [field, value] (field)}<div class="hp-auth-field"><label data-slot="label" for={`${panelId}-${field}`}>{label(field)}</label><Input autocomplete={field === 'email' ? 'email' : field === 'name' ? 'name' : undefined} checked={typeof value === 'boolean' ? value : undefined} id={`${panelId}-${field}`} name={field} type={inputType(field, value)} value={typeof value === 'boolean' ? undefined : String(value ?? '')} oninput={(event) => update(field, value, event.currentTarget)} /></div>{/each}{#if error}<p class="hp-auth-error" role="alert">{error}</p>{/if}{#if saved}<p class="hp-auth-success" role="status">Profile saved.</p>{/if}<Button class="hp-button hp-button-primary" type="submit">Save changes</Button></form></div>
  </section>
</main>
