import { createPanelTranslator, executePanelAuthRequest, panelContentWidthValue, syncDocumentLocale, type PanelTranslationKey } from '@holo-js/panels-vue'
import { defineComponent, h, onMounted, onUnmounted, ref, type VNode } from 'vue'
import { nuxtPanelAuthAppearanceVariables } from './auth-appearance'
import { useNuxtPanelAuthPresentation } from './auth-presentation'
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Field, FieldGroup, FieldLabel, Input, NativeSelect } from './internal-ui'

type AuthPageType = 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'password-reset-request' | 'password-reset' | 'registration'

const pageText: Readonly<Record<AuthPageType, readonly [PanelTranslationKey, PanelTranslationKey]>> = Object.freeze({
  'email-verification': ['auth.verifyEmail', 'auth.emailVerificationDescription'],
  'email-verification-verify': ['auth.verifyEmail', 'auth.emailVerificationLinkDescription'],
  'mfa-challenge': ['auth.twoFactorAuthentication', 'auth.mfaChallengeDescription'],
  'password-reset': ['auth.resetPassword', 'auth.resetPasswordDescription'],
  'password-reset-request': ['auth.forgotPasswordTitle', 'auth.forgotPasswordDescription'],
  registration: ['auth.createAccount', 'auth.createAccountDescription'],
})

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function field(id: string, label: string, model: { value: string }, type = 'text', autocomplete?: string): VNode {
  return h(Field, {}, () => [h(FieldLabel, { for: id }, () => label), h(Input, { autocomplete, id, modelValue: model.value, 'onUpdate:modelValue': (value: string | number) => { model.value = String(value) }, required: true, type })])
}

export const PanelAuthPage = defineComponent({
  name: 'PanelAuthPage',
  props: {
    panelId: { required: true, type: String },
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
    const locale = ref('en')
    let restoreDocumentLocale: (() => void) | undefined
    const presentation = useNuxtPanelAuthPresentation(props.panelId)
    const type = props.type as AuthPageType
    onMounted(() => {
      locale.value = navigator.language
      restoreDocumentLocale = syncDocumentLocale({ direction: locale.value.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr', locale: locale.value }, document)
    })
    onUnmounted(() => restoreDocumentLocale?.())
    const submit = async (): Promise<void> => {
      error.value = ''
      message.value = ''
      pending.value = true
      try {
        const operation = type === 'email-verification' ? 'email-verification-resend' : type === 'email-verification-verify' ? 'email-verification-verify' : type === 'mfa-challenge' ? method.value === 'recovery' ? 'mfa-recovery' : 'mfa-challenge' : type
        const payload = type === 'email-verification' ? {} : type === 'email-verification-verify' ? { token: new URLSearchParams(location.search).get('token') ?? '' } : type === 'mfa-challenge' ? { code: code.value } : type === 'password-reset-request' ? { email: email.value } : type === 'password-reset' ? { password: password.value, passwordConfirmation: passwordConfirmation.value, token: new URLSearchParams(location.search).get('token') ?? '' } : { credentials: { email: email.value, name: name.value, password: password.value, passwordConfirmation: passwordConfirmation.value } }
        const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId: props.panelId, payload })
        if (!result.ok) {
          error.value = createPanelTranslator(locale.value)('auth.requestFailed')
        } else if (result.url) {
          location.assign(result.url)
        } else {
          const translate = createPanelTranslator(locale.value)
          message.value = translate(type === 'password-reset-request' || type === 'email-verification' ? 'auth.emailSent' : 'auth.changesSaved')
        }
      } finally {
        pending.value = false
      }
    }
    return () => {
      if (!presentation.value) return h('main', { class: 'hp-auth-page', 'data-holo-panel': '' }, [h(Card, { class: 'hp-auth-card hp:h-80 hp:animate-pulse' })])
      const { appearance, brandName, loginPath, simplePageMaxContentWidth, theme } = presentation.value
      const translate = createPanelTranslator(locale.value)
      const direction = locale.value.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'
      const [titleKey, descriptionKey] = pageText[type]
      const title = translate(titleKey)
      const description = translate(descriptionKey)
      const fields = type === 'email-verification' || type === 'email-verification-verify' ? [] : type === 'mfa-challenge' ? [h(Field, {}, () => [h(FieldLabel, { for: `${props.panelId}-method` }, () => translate('auth.verificationMethod')), h(NativeSelect, { id: `${props.panelId}-method`, onChange: (event: Event) => { method.value = (event.currentTarget as HTMLSelectElement).value === 'recovery' ? 'recovery' : 'totp' }, value: method.value }, () => [h('option', { value: 'totp' }, translate('auth.authenticatorCode')), h('option', { value: 'recovery' }, translate('auth.recoveryCode'))])]), field(`${props.panelId}-code`, translate('auth.authenticationCode'), code, 'text', 'one-time-code')] : type === 'password-reset-request' ? [field(`${props.panelId}-email`, translate('auth.email'), email, 'email', 'email')] : [...(type === 'registration' ? [field(`${props.panelId}-name`, translate('auth.name'), name, 'text', 'name'), field(`${props.panelId}-email`, translate('auth.email'), email, 'email', 'email')] : []), field(`${props.panelId}-password`, translate('auth.password'), password, 'password', 'new-password'), field(`${props.panelId}-password-confirmation`, translate('auth.confirmPassword'), passwordConfirmation, 'password', 'new-password')]
      const card = h(Card, { class: 'hp-auth-card' }, () => [
        h(CardHeader, {}, () => [
          h(CardDescription, {}, () => brandName),
          h(CardTitle, {}, () => title),
          h(CardDescription, {}, () => description),
        ]),
        h(CardContent, {}, () => h('form', {
          onSubmit: (event: Event) => { event.preventDefault(); void submit() },
        }, [h(FieldGroup, {}, () => [
          ...fields,
          error.value ? h(Alert, { variant: 'destructive' }, () => h(AlertDescription, {}, () => error.value)) : null,
          message.value ? h(Alert, {}, () => h(AlertDescription, {}, () => message.value)) : null,
          h(Button, { disabled: pending.value, type: 'submit' }, () => translate(pending.value ? 'states.loading' : type === 'email-verification' ? 'auth.resendVerificationEmail' : type === 'email-verification-verify' ? 'auth.verifyEmailAction' : type === 'mfa-challenge' ? 'auth.verify' : 'auth.continue')),
        ])])),
        loginPath ? h(CardFooter, {}, () => h(Button, { as: 'a', href: loginPath, variant: 'link' }, () => translate('auth.backToSignIn'))) : null,
      ])
      return h('main', {
        class: 'hp-auth-page',
        'data-density': appearance.density,
        'data-holo-panel': '',
        'data-theme': theme,
        dir: direction,
        lang: locale.value,
        style: {
          ...nuxtPanelAuthAppearanceVariables(appearance),
          '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth),
        },
      }, [card])
    }
  },
})
