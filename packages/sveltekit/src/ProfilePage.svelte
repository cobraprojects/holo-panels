<script lang="ts">
  import { createPanelTranslator, executePanelAuthRequest, loadPanelAuthPresentation, panelContentWidthValue, syncDocumentLocale, type PanelAuthPresentation } from '@holo-js/panels-svelte'
  import { onMount } from 'svelte'
  import { svelteKitPanelAuthAppearanceStyleAttribute } from './auth-appearance'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import { Alert, AlertDescription } from '@holo-js/panels-svelte/ui/alert'
  import { Card, CardContent, CardDescription, CardHeader } from '@holo-js/panels-svelte/ui/card'
  import { Checkbox } from '@holo-js/panels-svelte/ui/checkbox'
  import { Field, FieldLabel } from '@holo-js/panels-svelte/ui/field'
  import Icon from './Icon.svelte'
  import { Input } from '@holo-js/panels-svelte/ui/input'

  interface Props {
    panelId: string
  }

  let { panelId }: Props = $props()
  let presentation = $state<PanelAuthPresentation | null>(null)
  let values = $state<Readonly<Record<string, unknown>>>({})
  let error = $state('')
  let saved = $state(false)
  let locale = $state('en')
  const translate = $derived(createPanelTranslator(locale))
  const direction = $derived(locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr')

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
    locale = navigator.language
    void loadPanelAuthPresentation(panelId).then(value => { presentation = value })
    void executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-read', panelId, payload: {} }).then((result) => {
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('values' in result.data) || typeof result.data.values !== 'object' || result.data.values === null || Array.isArray(result.data.values)) error = translate('auth.profileLoadFailed')
      else values = result.data.values as Readonly<Record<string, unknown>>
    })
    return syncDocumentLocale({ direction: locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr', locale }, document)
  })

  function update(field: string, current: unknown, input: HTMLInputElement): void {
    values = { ...values, [field]: typeof current === 'boolean' ? input.checked : typeof current === 'number' ? input.valueAsNumber : input.value }
  }

  function updateBoolean(field: string, checked: boolean): void {
    values = { ...values, [field]: checked }
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    error = ''
    saved = false
    const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-update', panelId, payload: { values } })
    if (!result.ok) error = translate('auth.profileSaveFailed')
    else saved = true
  }
</script>

{#if presentation}
<main class="hp-auth-page" data-density={presentation.appearance.density} data-holo-panel data-theme={presentation.theme} dir={direction} lang={locale} style={`${svelteKitPanelAuthAppearanceStyleAttribute(presentation.appearance)}--hp-auth-max-width:${panelContentWidthValue(presentation.simplePageMaxContentWidth)};`}>
  <Card class="hp-auth-card hp:w-full hp:max-w-md">
    <CardHeader><span class="hp-auth-brand-mark"><Icon name="user" /></span><CardDescription>{presentation.brandName}</CardDescription><h1 class="hp:text-2xl hp:font-semibold hp:leading-none">{translate('auth.profile')}</h1><CardDescription>{translate('auth.profileDescription')}</CardDescription></CardHeader>
    <CardContent><form class="hp:space-y-4" onsubmit={save}>{#each Object.entries(values) as [field, value] (field)}<Field orientation={typeof value === 'boolean' ? 'horizontal' : 'vertical'}><FieldLabel for={`${panelId}-${field}`}>{field === 'email' ? translate('auth.email') : field === 'name' ? translate('auth.name') : label(field)}</FieldLabel>{#if typeof value === 'boolean'}<Checkbox checked={value} id={`${panelId}-${field}`} name={field} onCheckedChange={(checked) => updateBoolean(field, checked)} />{:else}<Input autocomplete={field === 'email' ? 'email' : field === 'name' ? 'name' : undefined} id={`${panelId}-${field}`} name={field} type={inputType(field, value)} value={String(value ?? '')} oninput={(event) => update(field, value, event.currentTarget)} />{/if}</Field>{/each}{#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}{#if saved}<Alert><AlertDescription>{translate('auth.profileSaved')}</AlertDescription></Alert>{/if}<Button class="hp:w-full" type="submit">{translate('auth.saveChanges')}</Button></form></CardContent>
  </Card>
</main>
{:else}
<main class="hp-auth-page" data-holo-panel><Card class="hp-auth-card hp:h-80 hp:animate-pulse" /></main>
{/if}
