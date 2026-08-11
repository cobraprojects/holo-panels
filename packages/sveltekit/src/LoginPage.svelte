<script lang="ts">
  import { executePanelLogin, panelContentWidthValue, panelThemeStyleAttribute } from '@holo-js/panels-svelte'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'
  import Input from './Input.svelte'

  interface Props {
    brandName: string
    forgotPasswordPath?: string
    panelId: string
    registrationPath?: string
    simplePageMaxContentWidth?: string
    theme?: 'dark' | 'light' | 'system'
    themeColors?: Readonly<Record<string, string>>
  }

  let { brandName, forgotPasswordPath, panelId, registrationPath, simplePageMaxContentWidth, theme = 'system', themeColors }: Props = $props()
  let email = $state('')
  let password = $state('')
  let error = $state('')
  let pending = $state(false)

  function cookie(name: string): string {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
  }

  async function login(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!(event.currentTarget instanceof HTMLFormElement)) return
    const values = new FormData(event.currentTarget)
    const submittedEmail = values.get('email')
    const submittedPassword = values.get('password')
    if (typeof submittedEmail !== 'string' || typeof submittedPassword !== 'string') return
    error = ''
    pending = true
    try {
      const result = await executePanelLogin({ credentials: { email: submittedEmail, password: submittedPassword }, csrfToken: cookie('XSRF-TOKEN'), panelId })
      if (!result.ok || !result.url) {
        error = 'These credentials do not match our records.'
        return
      }
      window.location.assign(result.url)
    } finally {
      pending = false
    }
  }
</script>

<main class="hp-auth-page" data-holo-panel data-theme={theme} style={`${panelThemeStyleAttribute({ colors: themeColors })}${simplePageMaxContentWidth ? `--hp-auth-max-width:${panelContentWidthValue(simplePageMaxContentWidth)};` : ''}`}>
  <section class="hp-auth-card" data-slot="card">
    <div data-slot="card-header"><span class="hp-auth-brand-mark"><Icon name="key" /></span><div><p>Administration</p><h1>{brandName}</h1><span>Sign in to your account</span></div></div>
    <div data-slot="card-content">
      <form onsubmit={login}>
        <div class="hp-auth-field"><label data-slot="label" for={`${panelId}-email`}>Email</label><Input autocomplete="email" id={`${panelId}-email`} name="email" type="email" bind:value={email} required /></div>
        <div class="hp-auth-field"><div class="hp-auth-field-heading"><label data-slot="label" for={`${panelId}-password`}>Password</label>{#if forgotPasswordPath}<a href={forgotPasswordPath}>Forgot password?</a>{/if}</div><Input autocomplete="current-password" id={`${panelId}-password`} name="password" type="password" bind:value={password} required /></div>
        {#if error}<p class="hp-auth-error" role="alert">{error}</p>{/if}
        <Button class="hp-button hp-button-primary" disabled={pending} type="submit">{pending ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      {#if registrationPath}<p class="hp-auth-footer">Need an account? <a href={registrationPath}>Register</a></p>{/if}
    </div>
  </section>
</main>
