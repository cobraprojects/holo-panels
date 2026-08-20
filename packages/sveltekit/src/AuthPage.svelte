<script lang="ts">
  import { executePanelAuthRequest, panelContentWidthValue, type PanelClientAuthOperation } from '@holo-js/panels-svelte'
  import { svelteKitPanelAuthAppearanceStyleAttribute, type SvelteKitPanelAuthAppearance } from './auth-appearance'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import Input from './Input.svelte'

  type AuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'
  interface Props {
    appearance?: SvelteKitPanelAuthAppearance
    brandName: string
    loginPath?: string
    panelId: string
    simplePageMaxContentWidth?: string
    theme?: 'dark' | 'light' | 'system'
    themeColors?: Readonly<Record<string, string>>
    type: AuthPageType
  }

  let { appearance, brandName, loginPath, panelId, simplePageMaxContentWidth, theme = 'system', themeColors, type }: Props = $props()
  let name = $state('')
  let email = $state('')
  let password = $state('')
  let passwordConfirmation = $state('')
  let code = $state('')
  let method = $state<'recovery' | 'totp'>('totp')
  let error = $state('')
  let message = $state('')
  let pending = $state(false)

  const pageText: Readonly<Record<AuthPageType, readonly [string, string]>> = {
    'email-verification': ['Verify your email', 'Use the verification link in your email, or request another one.'],
    'email-verification-verify': ['Verify your email', 'Confirm the verification link for your account.'],
    'mfa-challenge': ['Two-factor authentication', 'Enter the code from your authenticator application.'],
    'password-reset': ['Reset your password', 'Choose a new password for your account.'],
    'password-reset-request': ['Forgot password', 'Enter your email and we will send a reset link.'],
    registration: ['Create an account', 'Register to access this panel.'],
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
      if (!result.ok) error = 'The request could not be completed. Check the entered information and try again.'
      else if (result.url) location.assign(result.url)
      else message = type === 'password-reset-request' || type === 'email-verification' ? 'The email has been sent.' : 'Your changes were saved.'
    } finally {
      pending = false
    }
  }
</script>

<main class="hp-auth-page" data-density={appearance?.density} data-holo-panel data-theme={theme} style={`${svelteKitPanelAuthAppearanceStyleAttribute(appearance, themeColors)}${simplePageMaxContentWidth ? `--hp-auth-max-width:${panelContentWidthValue(simplePageMaxContentWidth)};` : ''}`}>
  <section class="hp-auth-card" data-slot="card">
    <div data-slot="card-header"><span class="hp-auth-brand-mark"><Icon name={type === 'registration' ? 'user' : 'key'} /></span><div><p>{brandName}</p><h1>{pageText[type][0]}</h1><span>{pageText[type][1]}</span></div></div>
    <div data-slot="card-content">
      <form onsubmit={submit}>
        {#if type === 'mfa-challenge'}
          <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-method`}>Verification method</label><select data-slot="native-select" id={`${panelId}-method`} name="method" bind:value={method}><option value="totp">Authenticator code</option><option value="recovery">Recovery code</option></select></div>
          <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-code`}>Authentication code</label><Input autocomplete="one-time-code" id={`${panelId}-code`} name="code" bind:value={code} required /></div>
        {:else if type === 'password-reset-request'}
          <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-email`}>Email</label><Input autocomplete="email" id={`${panelId}-email`} type="email" bind:value={email} required /></div>
        {:else if type !== 'email-verification' && type !== 'email-verification-verify'}
          {#if type === 'registration'}
            <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-name`}>Name</label><Input autocomplete="name" id={`${panelId}-name`} bind:value={name} required /></div>
            <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-email`}>Email</label><Input autocomplete="email" id={`${panelId}-email`} type="email" bind:value={email} required /></div>
          {/if}
          <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-password`}>Password</label><Input autocomplete="new-password" id={`${panelId}-password`} type="password" bind:value={password} required /></div>
          <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-password-confirmation`}>Confirm password</label><Input autocomplete="new-password" id={`${panelId}-password-confirmation`} type="password" bind:value={passwordConfirmation} required /></div>
        {/if}
        {#if error}<p class="hp-auth-error" role="alert">{error}</p>{/if}
        {#if message}<p class="hp-auth-success" role="status">{message}</p>{/if}
        <Button class="hp-button hp-button-primary" disabled={pending} type="submit">{pending ? 'Please wait…' : type === 'email-verification' ? 'Resend verification email' : type === 'email-verification-verify' ? 'Verify email' : type === 'mfa-challenge' ? 'Verify' : 'Continue'}</Button>
      </form>
      {#if loginPath}<p class="hp-auth-footer"><a href={loginPath}>Back to sign in</a></p>{/if}
    </div>
  </section>
</main>
