import { executePanelLogin, panelContentWidthValue, panelLoginErrorMessage } from '@holo-js/panels-vue'
import { defineComponent, h, onMounted, ref } from 'vue'
import { nuxtPanelAuthAppearanceVariables } from './auth-appearance'
import { useNuxtPanelAuthPresentation } from './auth-presentation'
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Field, FieldGroup, FieldLabel, Input } from './internal-ui'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export const PanelLoginPage = defineComponent({
  name: 'PanelLoginPage',
  props: {
    panelId: { required: true, type: String },
  },
  setup(props) {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const pending = ref(false)
    const ready = ref(false)
    let submitting = false
    const presentation = useNuxtPanelAuthPresentation(props.panelId)
    onMounted(() => {
      ready.value = true
    })
    const login = async (): Promise<void> => {
      if (submitting) return
      submitting = true
      error.value = ''
      pending.value = true
      try {
        const result = await executePanelLogin({
          credentials: { email: email.value, password: password.value },
          csrfToken: cookie('XSRF-TOKEN'),
          panelId: props.panelId,
        })
        if (!result.ok || !result.url) {
          error.value = panelLoginErrorMessage(result)
          return
        }
        window.location.assign(result.url)
      } finally {
        submitting = false
        pending.value = false
      }
    }
    return () => {
      if (!presentation.value) return h('main', { class: 'hp-auth-page', 'data-holo-panel': '' }, [h(Card, { class: 'hp-auth-card hp:h-80 hp:animate-pulse' })])
      const { appearance, brandName, forgotPasswordPath, registrationPath, simplePageMaxContentWidth, theme } = presentation.value
      return h('main', { class: 'hp-auth-page', 'data-density': appearance.density, 'data-holo-panel': '', 'data-theme': theme, style: { ...nuxtPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } }, [
      h(Card, { class: 'hp-auth-card' }, () => [
        h(CardHeader, {}, () => [h(CardDescription, {}, () => 'Administration'), h(CardTitle, {}, () => brandName), h(CardDescription, {}, () => 'Sign in to your account')]),
        h(CardContent, {}, () => [
          h('form', { onSubmit: (event: Event) => { event.preventDefault(); void login() } }, [
            h(FieldGroup, {}, () => [
              h(Field, {}, () => [h(FieldLabel, { for: `${props.panelId}-email` }, () => 'Email'), h(Input, { autocomplete: 'email', disabled: !ready.value, id: `${props.panelId}-email`, modelValue: email.value, name: 'email', 'onUpdate:modelValue': (value: string | number) => { email.value = String(value) }, required: true, type: 'email' })]),
              h(Field, {}, () => [h('div', { class: 'hp:flex hp:items-center hp:justify-between' }, [h(FieldLabel, { for: `${props.panelId}-password` }, () => 'Password'), forgotPasswordPath ? h(Button, { as: 'a', href: forgotPasswordPath, variant: 'link' }, () => 'Forgot password?') : null]), h(Input, { autocomplete: 'current-password', disabled: !ready.value, id: `${props.panelId}-password`, modelValue: password.value, name: 'password', 'onUpdate:modelValue': (value: string | number) => { password.value = String(value) }, required: true, type: 'password' })]),
              error.value ? h(Alert, { variant: 'destructive' }, () => h(AlertDescription, {}, () => error.value)) : null,
              h(Button, { disabled: pending.value || !ready.value, type: 'submit' }, () => pending.value ? 'Signing in…' : 'Sign in'),
            ]),
          ]),
        ]),
        registrationPath ? h(CardFooter, {}, () => [h(CardDescription, {}, () => 'Need an account?'), h(Button, { as: 'a', href: registrationPath, variant: 'link' }, () => 'Register')]) : null,
      ]),
    ])
    }
  },
})
