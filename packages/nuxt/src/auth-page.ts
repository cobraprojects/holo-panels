import { executePanelAuthRequest, panelContentWidthValue, panelThemeVariables } from '@holo-js/panels-vue'
import { defineComponent, h, ref, type VNode } from 'vue'
import { ShadcnButton, ShadcnIcon, ShadcnInput, ShadcnSelect } from './internal-ui'

type AuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'

const pageText: Readonly<Record<AuthPageType, readonly [string, string]>> = Object.freeze({
  'email-verification': ['Verify your email', 'Use the verification link in your email, or request another one.'],
  'email-verification-verify': ['Verify your email', 'Confirm the verification link for your account.'],
  'mfa-challenge': ['Two-factor authentication', 'Enter the code from your authenticator application.'],
  'password-reset': ['Reset your password', 'Choose a new password for your account.'],
  'password-reset-request': ['Forgot password', 'Enter your email and we will send a reset link.'],
  registration: ['Create an account', 'Register to access this panel.'],
})

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function field(id: string, label: string, model: { value: string }, type = 'text', autocomplete?: string): VNode {
  return h('div', { class: 'hp-auth-field' }, [h('label', { 'data-slot': 'label', for: id }, label), h(ShadcnInput, { autocomplete, id, onInput: (event: Event) => { model.value = (event.currentTarget as HTMLInputElement).value }, required: true, type, value: model.value })])
}

export const PanelAuthPage = defineComponent({
  name: 'PanelAuthPage',
  props: {
    brandName: { required: true, type: String },
    loginPath: { default: undefined, type: String },
    panelId: { required: true, type: String },
    simplePageMaxContentWidth: { default: undefined, type: String },
    theme: { default: 'system', type: String },
    themeColors: { default: undefined, type: Object },
    type: { required: true, type: String },
  },
  setup(props) {
    const name = ref('')
    const email = ref('')
    const password = ref('')
    const passwordConfirmation = ref('')
    const code = ref('')
    const method = ref<'recovery' | 'totp'>('totp')
    const error = ref('')
    const message = ref('')
    const pending = ref(false)
    const type = props.type as AuthPageType
    const submit = async (): Promise<void> => {
      error.value = ''
      message.value = ''
      pending.value = true
      try {
        const operation = type === 'email-verification' ? 'email-verification-resend' : type === 'email-verification-verify' ? 'email-verification-verify' : type === 'mfa-challenge' ? method.value === 'recovery' ? 'mfa-recovery' : 'mfa-challenge' : type
        const payload = type === 'email-verification' ? {} : type === 'email-verification-verify' ? { token: new URLSearchParams(location.search).get('token') ?? '' } : type === 'mfa-challenge' ? { code: code.value } : type === 'password-reset-request' ? { email: email.value } : type === 'password-reset' ? { password: password.value, passwordConfirmation: passwordConfirmation.value, token: new URLSearchParams(location.search).get('token') ?? '' } : { credentials: { email: email.value, name: name.value, password: password.value, passwordConfirmation: passwordConfirmation.value } }
        const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId: props.panelId, payload })
        if (!result.ok) {
          error.value = 'The request could not be completed. Check the entered information and try again.'
        } else if (result.url) {
          location.assign(result.url)
        } else {
          message.value = type === 'password-reset-request' || type === 'email-verification' ? 'The email has been sent.' : 'Your changes were saved.'
        }
      } finally {
        pending.value = false
      }
    }
    return () => {
      const [title, description] = pageText[type]
      const fields = type === 'email-verification' || type === 'email-verification-verify' ? [] : type === 'mfa-challenge' ? [h('div', { class: 'hp-auth-field' }, [h('label', { 'data-slot': 'label', for: `${props.panelId}-method` }, 'Verification method'), h(ShadcnSelect, { id: `${props.panelId}-method`, onChange: (event: Event) => { method.value = (event.currentTarget as HTMLSelectElement).value === 'recovery' ? 'recovery' : 'totp' }, value: method.value }, () => [h('option', { value: 'totp' }, 'Authenticator code'), h('option', { value: 'recovery' }, 'Recovery code')])]), field(`${props.panelId}-code`, 'Authentication code', code, 'text', 'one-time-code')] : type === 'password-reset-request' ? [field(`${props.panelId}-email`, 'Email', email, 'email', 'email')] : [...(type === 'registration' ? [field(`${props.panelId}-name`, 'Name', name, 'text', 'name'), field(`${props.panelId}-email`, 'Email', email, 'email', 'email')] : []), field(`${props.panelId}-password`, 'Password', password, 'password', 'new-password'), field(`${props.panelId}-password-confirmation`, 'Confirm password', passwordConfirmation, 'password', 'new-password')]
      return h('main', { class: 'hp-auth-page', 'data-holo-panel': '', 'data-theme': props.theme, style: { ...panelThemeVariables({ colors: props.themeColors as Readonly<Record<string, unknown>> | undefined }), ...(props.simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(props.simplePageMaxContentWidth) } : {}) } }, [h('section', { class: 'hp-auth-card', 'data-slot': 'card' }, [h('div', { 'data-slot': 'card-header' }, [h('span', { class: 'hp-auth-brand-mark' }, [ShadcnIcon(type === 'registration' ? 'user' : 'key')]), h('div', [h('p', props.brandName), h('h1', title), h('span', description)])]), h('div', { 'data-slot': 'card-content' }, [h('form', { onSubmit: (event: Event) => { event.preventDefault(); void submit() } }, [...fields, error.value ? h('p', { class: 'hp-auth-error', role: 'alert' }, error.value) : null, message.value ? h('p', { class: 'hp-auth-success', role: 'status' }, message.value) : null, h(ShadcnButton, { class: 'hp-button hp-button-primary', disabled: pending.value, type: 'submit' }, () => pending.value ? 'Please wait…' : type === 'email-verification' ? 'Resend verification email' : type === 'email-verification-verify' ? 'Verify email' : type === 'mfa-challenge' ? 'Verify' : 'Continue')]), props.loginPath ? h('p', { class: 'hp-auth-footer' }, [h('a', { href: props.loginPath }, 'Back to sign in')]) : null])])])
    }
  },
})
