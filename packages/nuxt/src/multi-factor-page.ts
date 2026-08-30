import { createPanelTranslator, executePanelAuthRequest, panelContentWidthValue, syncDocumentLocale, type PanelClientAuthOperation } from '@holo-js/panels-vue'
import { defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { nuxtPanelAuthAppearanceVariables } from './auth-appearance'
import { useNuxtPanelAuthPresentation } from './auth-presentation'
import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, FieldGroup, FieldLabel, Input, NativeSelect, PanelsIcon } from './internal-ui'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export const PanelMultiFactorPage = defineComponent({
  name: 'PanelMultiFactorPage',
  props: {
    panelId: { required: true, type: String },
  },
  setup(props) {
    const enabled = ref(false)
    const manualKey = ref('')
    const recoveryCodes = ref<readonly string[]>([])
    const code = ref('')
    const method = ref<'recovery' | 'totp'>('totp')
    const error = ref('')
    const locale = ref('en')
    const disableConfirmationOpen = ref(false)
    let restoreDocumentLocale: (() => void) | undefined
    const presentation = useNuxtPanelAuthPresentation(props.panelId)
    watch(presentation, (value) => {
      if (!value) return
      locale.value = value.locale
      restoreDocumentLocale?.()
      restoreDocumentLocale = syncDocumentLocale({ direction: value.direction, locale: value.locale }, document)
    })
    const request = (operation: PanelClientAuthOperation, payload: Readonly<Record<string, unknown>> = {}) => executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId: props.panelId, payload })
    onMounted(() => {
      void request('mfa-status').then((result) => {
        if (result.ok && typeof result.data === 'object' && result.data !== null && 'enabled' in result.data) enabled.value = result.data.enabled === true
      })
    })
    onUnmounted(() => restoreDocumentLocale?.())
    const begin = async (): Promise<void> => {
      const result = await request('mfa-enrollment-begin')
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('manualKey' in result.data)) return void (error.value = createPanelTranslator(locale.value)('auth.enrollmentStartFailed'))
      manualKey.value = String(result.data.manualKey)
    }
    const confirm = async (): Promise<void> => {
      const result = await request('mfa-enrollment-confirm', { code: code.value })
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('recoveryCodes' in result.data) || !Array.isArray(result.data.recoveryCodes)) return void (error.value = createPanelTranslator(locale.value)('auth.enrollmentConfirmFailed'))
      recoveryCodes.value = result.data.recoveryCodes.map(String)
      enabled.value = true
    }
    const protectedAction = async (operation: 'mfa-disable' | 'mfa-recovery-codes-regenerate'): Promise<void> => {
      const result = await request(operation, { code: code.value, method: method.value })
      if (!result.ok) return void (error.value = createPanelTranslator(locale.value)('auth.mfaRequestFailed'))
      if (operation === 'mfa-disable') {
        enabled.value = false
        manualKey.value = ''
        recoveryCodes.value = []
      } else if (typeof result.data === 'object' && result.data !== null && 'recoveryCodes' in result.data && Array.isArray(result.data.recoveryCodes)) recoveryCodes.value = result.data.recoveryCodes.map(String)
    }
    const verificationFields = () => {
      const translate = createPanelTranslator(locale.value)
      return [h(Field, {}, () => [h(FieldLabel, { for: `${props.panelId}-method` }, () => translate('auth.verificationMethod')), h(NativeSelect, { id: `${props.panelId}-method`, name: 'method', onChange: (event: Event) => { method.value = (event.currentTarget as HTMLSelectElement).value === 'recovery' ? 'recovery' : 'totp' }, value: method.value }, () => [h('option', { value: 'totp' }, translate('auth.authenticatorCode')), h('option', { value: 'recovery' }, translate('auth.recoveryCode'))])]), h(Field, {}, () => [h(FieldLabel, { for: `${props.panelId}-code` }, () => translate('auth.authenticationCode')), h(Input, { id: `${props.panelId}-code`, modelValue: code.value, 'onUpdate:modelValue': (value: string | number) => { code.value = String(value) }, required: true })])]
    }
    return () => {
      if (!presentation.value) return h('main', { class: 'hp-auth-page', 'data-holo-panel': '' }, [h(Card, { class: 'hp-auth-card hp:h-80 hp:animate-pulse' })])
      const { appearance, brandName, simplePageMaxContentWidth, theme } = presentation.value
      const translate = createPanelTranslator(locale.value)
      const direction = presentation.value.direction
      const disableDialog = h(AlertDialog, { open: disableConfirmationOpen.value, 'onUpdate:open': (open: boolean) => { disableConfirmationOpen.value = open } }, () => h(AlertDialogContent, {}, () => [
        h(AlertDialogHeader, {}, () => [h(AlertDialogTitle, {}, () => translate('auth.disableMfa')), h(AlertDialogDescription, {}, () => translate('auth.disableMfaDescription'))]),
        h(FieldGroup, {}, verificationFields),
        h(AlertDialogFooter, {}, () => [
          h(AlertDialogCancel, {}, () => translate('actions.cancel')),
          h(AlertDialogAction, { onClick: () => { disableConfirmationOpen.value = false; void protectedAction('mfa-disable') }, variant: 'destructive' }, () => [PanelsIcon('trash'), translate('actions.confirm')]),
        ]),
      ]))
      const card = h(Card, { class: 'hp-auth-card' }, () => [
        h(CardHeader, {}, () => [h(CardDescription, {}, () => brandName), h(CardTitle, {}, () => translate('auth.mfaTitle')), h(CardDescription, {}, () => translate(enabled.value ? 'auth.mfaEnabled' : 'auth.mfaDisabled'))]),
        h(CardContent, {}, () => h(FieldGroup, {}, () => [
          !enabled.value && !manualKey.value ? h(Button, { onClick: () => void begin() }, () => [PanelsIcon('key'), translate('auth.beginEnrollment')]) : null,
          manualKey.value ? h(Card, {}, () => [h(CardHeader, {}, () => [h(CardTitle, {}, () => translate('auth.authenticatorSetup')), h(CardDescription, {}, () => [`${translate('auth.manualKey')}: `, h('code', manualKey.value)])]), h(CardContent, {}, () => h('form', { onSubmit: (event: Event) => { event.preventDefault(); void confirm() } }, [h(FieldGroup, {}, () => [verificationFields()[1], h(Button, { type: 'submit' }, () => [PanelsIcon('check'), translate('auth.confirmEnrollment')])])]))]) : null,
          recoveryCodes.value.length ? h('section', { 'aria-labelledby': `${props.panelId}-recovery-codes-heading` }, [h(Card, {}, () => [h(CardHeader, {}, () => h(CardTitle, { id: `${props.panelId}-recovery-codes-heading` }, () => translate('auth.recoveryCodes'))), h(CardContent, {}, () => h('ul', recoveryCodes.value.map(value => h('li', { key: value }, [h('code', value)]))))])]) : null,
          enabled.value ? h('form', { onSubmit: (event: Event) => { event.preventDefault(); void protectedAction('mfa-recovery-codes-regenerate') } }, [h(FieldGroup, {}, () => [...verificationFields(), h(Button, { type: 'submit', variant: 'outline' }, () => [PanelsIcon('restore'), translate('auth.regenerateRecoveryCodes')])])]) : null,
          enabled.value ? h(Button, { onClick: () => { disableConfirmationOpen.value = true }, variant: 'destructive' }, () => [PanelsIcon('trash'), translate('auth.disableMfaAction')]) : null,
          error.value ? h(Alert, { variant: 'destructive' }, () => h(AlertDescription, {}, () => error.value)) : null,
          disableDialog,
        ])),
      ])
      return h('main', { class: 'hp-auth-page', 'data-density': appearance.density, 'data-holo-panel': '', 'data-theme': theme, dir: direction, lang: locale.value, style: { ...nuxtPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } }, [card])
    }
  },
})
