<script lang="ts">
  import { createPanelTranslator, executePanelAuthRequest, loadPanelAuthPresentation, panelContentWidthValue, syncDocumentLocale, type PanelAuthPresentation, type PanelClientAuthOperation, type PanelTranslationKey } from '@holo-js/panels-svelte'
  import { onMount } from 'svelte'
  import { svelteKitPanelAuthAppearanceStyleAttribute } from './auth-appearance'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import { Alert, AlertDescription } from '@holo-js/panels-svelte/ui/alert'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@holo-js/panels-svelte/ui/card'
  import { Field, FieldLabel } from '@holo-js/panels-svelte/ui/field'
  import Icon from './Icon.svelte'
  import { Input } from '@holo-js/panels-svelte/ui/input'
  import { NativeSelect, NativeSelectOption } from '@holo-js/panels-svelte/ui/native-select'

  type AuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'
  interface Props {
    panelId: string
    type: AuthPageType
  }

  let { panelId, type }: Props = $props()
  let presentation = $state<PanelAuthPresentation | null>(null)
  let name = $state('')
  let email = $state('')
  let password = $state('')
  let passwordConfirmation = $state('')
  let code = $state('')
  let method = $state<'recovery' | 'totp'>('totp')
  let error = $state('')
  let message = $state('')
  let pending = $state(false)
  let locale = $state('en')
  const translate = $derived(createPanelTranslator(locale))
  const direction = $derived(locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr')

  onMount(() => {
    locale = navigator.language
    void loadPanelAuthPresentation(panelId).then(value => { presentation = value })
    return syncDocumentLocale({ direction: locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr', locale }, document)
  })

  const pageText: Readonly<Record<AuthPageType, readonly [PanelTranslationKey, PanelTranslationKey]>> = {
    'email-verification': ['auth.verifyEmail', 'auth.emailVerificationDescription'],
    'email-verification-verify': ['auth.verifyEmail', 'auth.emailVerificationLinkDescription'],
    'mfa-challenge': ['auth.twoFactorAuthentication', 'auth.mfaChallengeDescription'],
    'password-reset': ['auth.resetPassword', 'auth.resetPasswordDescription'],
    'password-reset-request': ['auth.forgotPasswordTitle', 'auth.forgotPasswordDescription'],
    registration: ['auth.createAccount', 'auth.createAccountDescription'],
  }

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!(event.currentTarget instanceof HTMLFormElement)) return
    const values = new FormData(event.currentTarget)
    error = ''
    message = ''
    pending = true
    try {
      const operation: PanelClientAuthOperation = type === 'email-verification' ? 'email-verification-resend' : type === 'email-verification-verify' ? 'email-verification-verify' : type === 'mfa-challenge' ? values.get('method') === 'recovery' ? 'mfa-recovery' : 'mfa-challenge' : type
      const passwordValue = String(values.get('password') ?? '')
      const passwordConfirmationValue = String(values.get('passwordConfirmation') ?? '')
      const payload = type === 'email-verification' ? {} : type === 'email-verification-verify' ? { token: new URLSearchParams(location.search).get('token') ?? '' } : type === 'mfa-challenge' ? { code: String(values.get('code') ?? '') } : type === 'password-reset-request' ? { email: String(values.get('email') ?? '') } : type === 'password-reset' ? { password: passwordValue, passwordConfirmation: passwordConfirmationValue, token: new URLSearchParams(location.search).get('token') ?? '' } : { credentials: { email: String(values.get('email') ?? ''), name: String(values.get('name') ?? ''), password: passwordValue, passwordConfirmation: passwordConfirmationValue } }
      const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId, payload })
      if (!result.ok) error = translate('auth.requestFailed')
      else if (result.url) location.assign(result.url)
      else message = translate(type === 'password-reset-request' || type === 'email-verification' ? 'auth.emailSent' : 'auth.changesSaved')
    } finally {
      pending = false
    }
  }
</script>

{#if presentation}
<main class="hp-auth-page" data-density={presentation.appearance.density} data-holo-panel data-theme={presentation.theme} dir={direction} lang={locale} style={`${svelteKitPanelAuthAppearanceStyleAttribute(presentation.appearance)}--hp-auth-max-width:${panelContentWidthValue(presentation.simplePageMaxContentWidth)};`}>
  <Card class="hp-auth-card hp:w-full hp:max-w-md">
    <CardHeader><span class="hp-auth-brand-mark"><Icon name={type === 'registration' ? 'user' : 'key'} /></span><CardDescription>{presentation.brandName}</CardDescription><CardTitle>{translate(pageText[type][0])}</CardTitle><CardDescription>{translate(pageText[type][1])}</CardDescription></CardHeader>
    <CardContent class="hp:space-y-6">
      <form class="hp:space-y-4" onsubmit={submit}>
        {#if type === 'mfa-challenge'}
          <Field><FieldLabel for={`${panelId}-method`}>{translate('auth.verificationMethod')}</FieldLabel><NativeSelect id={`${panelId}-method`} name="method" bind:value={method}><NativeSelectOption value="totp">{translate('auth.authenticatorCode')}</NativeSelectOption><NativeSelectOption value="recovery">{translate('auth.recoveryCode')}</NativeSelectOption></NativeSelect></Field>
          <Field><FieldLabel for={`${panelId}-code`}>{translate('auth.authenticationCode')}</FieldLabel><Input autocomplete="one-time-code" id={`${panelId}-code`} name="code" bind:value={code} required /></Field>
        {:else if type === 'password-reset-request'}
          <Field><FieldLabel for={`${panelId}-email`}>{translate('auth.email')}</FieldLabel><Input autocomplete="email" id={`${panelId}-email`} type="email" bind:value={email} required /></Field>
        {:else if type !== 'email-verification' && type !== 'email-verification-verify'}
          {#if type === 'registration'}
            <Field><FieldLabel for={`${panelId}-name`}>{translate('auth.name')}</FieldLabel><Input autocomplete="name" id={`${panelId}-name`} bind:value={name} required /></Field>
            <Field><FieldLabel for={`${panelId}-email`}>{translate('auth.email')}</FieldLabel><Input autocomplete="email" id={`${panelId}-email`} type="email" bind:value={email} required /></Field>
          {/if}
          <Field><FieldLabel for={`${panelId}-password`}>{translate('auth.password')}</FieldLabel><Input autocomplete="new-password" id={`${panelId}-password`} type="password" bind:value={password} required /></Field>
          <Field><FieldLabel for={`${panelId}-password-confirmation`}>{translate('auth.confirmPassword')}</FieldLabel><Input autocomplete="new-password" id={`${panelId}-password-confirmation`} type="password" bind:value={passwordConfirmation} required /></Field>
        {/if}
        {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
        {#if message}<Alert><AlertDescription>{message}</AlertDescription></Alert>{/if}
        <Button class="hp:w-full" disabled={pending} type="submit">{translate(pending ? 'states.loading' : type === 'email-verification' ? 'auth.resendVerificationEmail' : type === 'email-verification-verify' ? 'auth.verifyEmailAction' : type === 'mfa-challenge' ? 'auth.verify' : 'auth.continue')}</Button>
      </form>
      {#if presentation.loginPath}<p class="hp-auth-footer hp:text-center"><Button href={presentation.loginPath} variant="link">{translate('auth.backToSignIn')}</Button></p>{/if}
    </CardContent>
  </Card>
</main>
{:else}
<main class="hp-auth-page" data-holo-panel><Card class="hp-auth-card hp:h-80 hp:animate-pulse" /></main>
{/if}
