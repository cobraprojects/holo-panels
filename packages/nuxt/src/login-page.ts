import { executePanelLogin, panelContentWidthValue } from '@holo-js/panels-vue'
import { defineComponent, h, ref, type PropType } from 'vue'
import { nuxtPanelAuthAppearanceVariables, type NuxtPanelAuthAppearance } from './auth-appearance'
import { ShadcnButton, ShadcnIcon, ShadcnInput } from './internal-ui'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export const PanelLoginPage = defineComponent({
  name: 'PanelLoginPage',
  props: {
    appearance: { default: undefined, type: Object as PropType<NuxtPanelAuthAppearance> },
    brandName: { required: true, type: String },
    forgotPasswordPath: { default: undefined, type: String },
    panelId: { required: true, type: String },
    registrationPath: { default: undefined, type: String },
    simplePageMaxContentWidth: { default: undefined, type: String },
    theme: { default: 'system', type: String },
    themeColors: { default: undefined, type: Object },
  },
  setup(props) {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const pending = ref(false)
    const login = async (): Promise<void> => {
      error.value = ''
      pending.value = true
      try {
        const result = await executePanelLogin({
          credentials: { email: email.value, password: password.value },
          csrfToken: cookie('XSRF-TOKEN'),
          panelId: props.panelId,
        })
        if (!result.ok || !result.url) {
          error.value = 'These credentials do not match our records.'
          return
        }
        window.location.assign(result.url)
      } finally {
        pending.value = false
      }
    }
    return () => h('main', { class: 'hp-auth-page', 'data-density': props.appearance?.density, 'data-holo-panel': '', 'data-theme': props.theme, style: { ...nuxtPanelAuthAppearanceVariables(props.appearance, props.themeColors as Readonly<Record<string, string>> | undefined), ...(props.simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(props.simplePageMaxContentWidth) } : {}) } }, [
      h('section', { class: 'hp-auth-card', 'data-slot': 'card' }, [
        h('div', { 'data-slot': 'card-header' }, [h('span', { class: 'hp-auth-brand-mark' }, [ShadcnIcon('key')]), h('div', [h('p', 'Administration'), h('h1', props.brandName), h('span', 'Sign in to your account')])]),
        h('div', { 'data-slot': 'card-content' }, [
          h('form', { onSubmit: (event: Event) => { event.preventDefault(); void login() } }, [
            h('div', { class: 'hp-auth-field' }, [h('label', { 'data-slot': 'label', for: `${props.panelId}-email` }, 'Email'), h(ShadcnInput, { autocomplete: 'email', id: `${props.panelId}-email`, name: 'email', onInput: (event: Event) => { email.value = (event.currentTarget as HTMLInputElement).value }, required: true, type: 'email', value: email.value })]),
            h('div', { class: 'hp-auth-field' }, [h('div', { class: 'hp-auth-field-heading' }, [h('label', { 'data-slot': 'label', for: `${props.panelId}-password` }, 'Password'), props.forgotPasswordPath ? h('a', { href: props.forgotPasswordPath }, 'Forgot password?') : null]), h(ShadcnInput, { autocomplete: 'current-password', id: `${props.panelId}-password`, name: 'password', onInput: (event: Event) => { password.value = (event.currentTarget as HTMLInputElement).value }, required: true, type: 'password', value: password.value })]),
            error.value ? h('p', { class: 'hp-auth-error', role: 'alert' }, error.value) : null,
            h(ShadcnButton, { class: 'hp-button hp-button-primary', disabled: pending.value, type: 'submit' }, () => pending.value ? 'Signing in…' : 'Sign in'),
          ]),
          props.registrationPath ? h('p', { class: 'hp-auth-footer' }, ['Need an account? ', h('a', { href: props.registrationPath }, 'Register')]) : null,
        ]),
      ]),
    ])
  },
})
