<script lang="ts">
  import { createPanelTranslator, executePanelLogin, loadPanelAuthPresentation, panelContentWidthValue, panelLoginErrorMessage, syncDocumentLocale, type PanelAuthPresentation } from '@holo-js/panels-svelte'
  import { onMount } from 'svelte'
  import { svelteKitPanelAuthAppearanceStyleAttribute } from './auth-appearance'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@holo-js/panels-svelte/ui/card'
  import { Field, FieldLabel } from '@holo-js/panels-svelte/ui/field'
  import { Alert, AlertDescription } from '@holo-js/panels-svelte/ui/alert'
  import Icon from './Icon.svelte'
  import { Input } from '@holo-js/panels-svelte/ui/input'

  interface Props {
    panelId: string
  }

  let { panelId }: Props = $props()
  let presentation = $state<PanelAuthPresentation | null>(null)
  let email = $state('')
  let password = $state('')
  let error = $state('')
  let pending = $state(false)
  const locale = $derived(presentation?.locale ?? 'en')
  const translate = $derived(createPanelTranslator(locale))
  const direction = $derived(presentation?.direction ?? 'ltr')
  let submitting = false

  onMount(() => {
    void loadPanelAuthPresentation(panelId).then(value => { presentation = value })
  })

  $effect(() => presentation ? syncDocumentLocale({ direction: presentation.direction, locale: presentation.locale }, document) : undefined)

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  async function login(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (submitting) return
    if (!(event.currentTarget instanceof HTMLFormElement)) return
    const values = new FormData(event.currentTarget)
    const submittedEmail = values.get('email')
    const submittedPassword = values.get('password')
    if (typeof submittedEmail !== 'string' || typeof submittedPassword !== 'string') return
    submitting = true
    error = ''
    pending = true
    try {
      const result = await executePanelLogin({ credentials: { email: submittedEmail, password: submittedPassword }, csrfToken: cookie('XSRF-TOKEN'), panelId })
      if (!result.ok || !result.url) {
        error = panelLoginErrorMessage(result, locale)
        return
      }
      window.location.assign(result.url)
    } finally {
      submitting = false
      pending = false
    }
  }
</script>

{#if presentation}
<main class="hp-auth-page" data-density={presentation.appearance.density} data-holo-panel data-theme={presentation.theme} dir={direction} lang={locale} style={`${svelteKitPanelAuthAppearanceStyleAttribute(presentation.appearance)}--hp-auth-max-width:${panelContentWidthValue(presentation.simplePageMaxContentWidth)};`}>
  <Card class="hp-auth-card hp:w-full hp:max-w-md">
    <CardHeader><span class="hp-auth-brand-mark"><Icon name="key" /></span><CardDescription>{translate('auth.administration')}</CardDescription><CardTitle>{presentation.brandName}</CardTitle><CardDescription>{translate('auth.signInDescription')}</CardDescription></CardHeader>
    <CardContent class="hp:space-y-6">
      <form class="hp:space-y-4" onsubmit={login}>
        <Field><FieldLabel for={`${panelId}-email`}>{translate('auth.email')}</FieldLabel><Input autocomplete="email" id={`${panelId}-email`} name="email" type="email" bind:value={email} required /></Field>
        <Field><div class="hp:flex hp:items-center hp:justify-between"><FieldLabel for={`${panelId}-password`}>{translate('auth.password')}</FieldLabel>{#if presentation.forgotPasswordPath}<Button href={presentation.forgotPasswordPath} size="sm" variant="link">{translate('auth.forgotPassword')}</Button>{/if}</div><Input autocomplete="current-password" id={`${panelId}-password`} name="password" type="password" bind:value={password} required /></Field>
        {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
        <Button class="hp:w-full" disabled={pending} type="submit">{pending ? translate('auth.signingIn') : translate('auth.signIn')}</Button>
      </form>
      {#if presentation.registrationPath}<p class="hp-auth-footer hp:text-center hp:text-sm hp:text-muted-foreground">{translate('auth.needAccount')} <Button href={presentation.registrationPath} size="sm" variant="link">{translate('auth.register')}</Button></p>{/if}
    </CardContent>
  </Card>
</main>
{:else}
<main class="hp-auth-page" data-holo-panel><Card class="hp-auth-card hp:h-80 hp:animate-pulse" /></main>
{/if}
