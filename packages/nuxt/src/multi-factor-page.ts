import { executePanelAuthRequest, panelContentWidthValue, type PanelClientAuthOperation } from '@holo-js/panels-vue'
import { defineComponent, h, onMounted, ref, type PropType } from 'vue'
import { nuxtPanelAuthAppearanceVariables, type NuxtPanelAuthAppearance } from './auth-appearance'
import { ShadcnButton, ShadcnIcon, ShadcnInput, ShadcnSelect } from './internal-ui'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

export const PanelMultiFactorPage = defineComponent({
  name: 'PanelMultiFactorPage',
  props: {
    appearance: { default: undefined, type: Object as PropType<NuxtPanelAuthAppearance> },
    brandName: { required: true, type: String },
    panelId: { required: true, type: String },
    simplePageMaxContentWidth: { default: undefined, type: String },
    theme: { default: 'system', type: String },
    themeColors: { default: undefined, type: Object },
  },
  setup(props) {
    const enabled = ref(false)
    const manualKey = ref('')
    const recoveryCodes = ref<readonly string[]>([])
    const code = ref('')
    const method = ref<'recovery' | 'totp'>('totp')
    const error = ref('')
    const request = (operation: PanelClientAuthOperation, payload: Readonly<Record<string, unknown>> = {}) => executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId: props.panelId, payload })
    onMounted(() => void request('mfa-status').then((result) => {
      if (result.ok && typeof result.data === 'object' && result.data !== null && 'enabled' in result.data) enabled.value = result.data.enabled === true
    }))
    const begin = async (): Promise<void> => {
      const result = await request('mfa-enrollment-begin')
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('manualKey' in result.data)) return void (error.value = 'Multi-factor enrollment could not be started.')
      manualKey.value = String(result.data.manualKey)
    }
    const confirm = async (): Promise<void> => {
      const result = await request('mfa-enrollment-confirm', { code: code.value })
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('recoveryCodes' in result.data) || !Array.isArray(result.data.recoveryCodes)) return void (error.value = 'Multi-factor enrollment could not be confirmed.')
      recoveryCodes.value = result.data.recoveryCodes.map(String)
      enabled.value = true
    }
    const protectedAction = async (operation: 'mfa-disable' | 'mfa-recovery-codes-regenerate'): Promise<void> => {
      const result = await request(operation, { code: code.value, method: method.value })
      if (!result.ok) return void (error.value = 'The multi-factor request could not be completed.')
      if (operation === 'mfa-disable') {
        enabled.value = false
        manualKey.value = ''
        recoveryCodes.value = []
      } else if (typeof result.data === 'object' && result.data !== null && 'recoveryCodes' in result.data && Array.isArray(result.data.recoveryCodes)) recoveryCodes.value = result.data.recoveryCodes.map(String)
    }
    const verificationFields = () => [h('div', { class: 'hp-auth-field' }, [h('label', { 'data-slot': 'label', for: `${props.panelId}-method` }, 'Verification method'), h(ShadcnSelect, { id: `${props.panelId}-method`, name: 'method', onChange: (event: Event) => { method.value = (event.currentTarget as HTMLSelectElement).value === 'recovery' ? 'recovery' : 'totp' }, value: method.value }, () => [h('option', { value: 'totp' }, 'Authenticator code'), h('option', { value: 'recovery' }, 'Recovery code')])]), h('div', { class: 'hp-auth-field' }, [h('label', { 'data-slot': 'label', for: `${props.panelId}-code` }, 'Authentication code'), h(ShadcnInput, { id: `${props.panelId}-code`, onInput: (event: Event) => { code.value = (event.currentTarget as HTMLInputElement).value }, required: true, value: code.value })])]
    return () => h('main', { class: 'hp-auth-page', 'data-density': props.appearance?.density, 'data-holo-panel': '', 'data-theme': props.theme, style: { ...nuxtPanelAuthAppearanceVariables(props.appearance, props.themeColors as Readonly<Record<string, string>> | undefined), ...(props.simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(props.simplePageMaxContentWidth) } : {}) } }, [h('section', { class: 'hp-auth-card', 'data-slot': 'card' }, [h('div', { 'data-slot': 'card-header' }, [h('span', { class: 'hp-auth-brand-mark' }, [ShadcnIcon('key')]), h('div', [h('p', props.brandName), h('h1', 'Multi-factor authentication'), h('span', `MFA is ${enabled.value ? 'enabled' : 'disabled'}.`)])]), h('div', { 'data-slot': 'card-content' }, [!enabled.value && !manualKey.value ? h(ShadcnButton, { class: 'hp-button hp-button-primary', onClick: () => void begin() }, () => 'Begin enrollment') : null, manualKey.value ? h('section', [h('p', ['Manual key: ', h('code', manualKey.value)]), h('form', { onSubmit: (event: Event) => { event.preventDefault(); void confirm() } }, [verificationFields()[1], h(ShadcnButton, { class: 'hp-button hp-button-primary', type: 'submit' }, () => 'Confirm enrollment')])]) : null, recoveryCodes.value.length ? h('section', { 'aria-label': 'Recovery codes' }, [h('h2', 'Recovery codes'), h('ul', recoveryCodes.value.map(value => h('li', { key: value }, [h('code', value)])))]) : null, enabled.value ? h('form', { onSubmit: (event: Event) => { event.preventDefault(); void protectedAction('mfa-recovery-codes-regenerate') } }, [...verificationFields(), h(ShadcnButton, { class: 'hp-button', type: 'submit' }, () => 'Regenerate recovery codes')]) : null, enabled.value ? h('form', { onSubmit: (event: Event) => { event.preventDefault(); void protectedAction('mfa-disable') } }, [...verificationFields(), h(ShadcnButton, { class: 'hp-button hp-button-destructive', type: 'submit' }, () => 'Disable multi-factor authentication')]) : null, error.value ? h('p', { class: 'hp-auth-error', role: 'alert' }, error.value) : null])])])
  },
})
