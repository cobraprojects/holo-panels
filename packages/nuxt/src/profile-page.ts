import { executePanelAuthRequest, panelContentWidthValue } from '@holo-js/panels-vue'
import { defineComponent, h, onMounted, ref, type PropType } from 'vue'
import { nuxtPanelAuthAppearanceVariables, type NuxtPanelAuthAppearance } from './auth-appearance'
import { ShadcnButton, ShadcnIcon, ShadcnInput } from './internal-ui'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function label(field: string): string {
  return field.replaceAll('_', ' ').replace(/\b\w/gu, letter => letter.toUpperCase())
}

function inputType(field: string, value: unknown): 'checkbox' | 'email' | 'number' | 'text' {
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  return field === 'email' ? 'email' : 'text'
}

export const PanelProfilePage = defineComponent({
  name: 'PanelProfilePage',
  props: {
    appearance: { default: undefined, type: Object as PropType<NuxtPanelAuthAppearance> },
    brandName: { required: true, type: String },
    panelId: { required: true, type: String },
    simplePageMaxContentWidth: { default: undefined, type: String },
    theme: { default: 'system', type: String },
    themeColors: { default: undefined, type: Object },
  },
  setup(props) {
    const values = ref<Readonly<Record<string, unknown>>>({})
    const error = ref('')
    const saved = ref(false)
    const request = (operation: 'profile-read' | 'profile-update', payload: Readonly<Record<string, unknown>>) => executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation, panelId: props.panelId, payload })
    onMounted(() => void request('profile-read', {}).then((result) => {
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('values' in result.data) || typeof result.data.values !== 'object' || result.data.values === null || Array.isArray(result.data.values)) error.value = 'The profile could not be loaded.'
      else values.value = result.data.values as Readonly<Record<string, unknown>>
    }))
    const save = async (): Promise<void> => {
      const result = await request('profile-update', { values: values.value })
      if (!result.ok) error.value = 'The profile could not be saved.'
      else saved.value = true
    }
    return () => h('main', { class: 'hp-auth-page', 'data-density': props.appearance?.density, 'data-holo-panel': '', 'data-theme': props.theme, style: { ...nuxtPanelAuthAppearanceVariables(props.appearance, props.themeColors as Readonly<Record<string, string>> | undefined), ...(props.simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(props.simplePageMaxContentWidth) } : {}) } }, [h('section', { class: 'hp-auth-card', 'data-slot': 'card' }, [h('div', { 'data-slot': 'card-header' }, [h('span', { class: 'hp-auth-brand-mark' }, [ShadcnIcon('user')]), h('div', [h('p', props.brandName), h('h1', 'Profile'), h('span', 'Manage your account information.')])]), h('div', { 'data-slot': 'card-content' }, [h('form', { onSubmit: (event: Event) => { event.preventDefault(); void save() } }, [...Object.entries(values.value).map(([field, value]) => h('div', { class: 'hp-auth-field', key: field }, [h('label', { 'data-slot': 'label', for: `${props.panelId}-${field}` }, label(field)), h(ShadcnInput, { autocomplete: field === 'email' ? 'email' : field === 'name' ? 'name' : undefined, checked: typeof value === 'boolean' ? value : undefined, id: `${props.panelId}-${field}`, name: field, onInput: (event: Event) => { const next = (event.currentTarget as HTMLInputElement); values.value = { ...values.value, [field]: typeof value === 'boolean' ? next.checked : typeof value === 'number' ? next.valueAsNumber : next.value } }, type: inputType(field, value), value: typeof value === 'boolean' ? undefined : String(value ?? '') })])), error.value ? h('p', { class: 'hp-auth-error', role: 'alert' }, error.value) : null, saved.value ? h('p', { class: 'hp-auth-success', role: 'status' }, 'Profile saved.') : null, h(ShadcnButton, { class: 'hp-button hp-button-primary', type: 'submit' }, () => 'Save changes')])])])])
  },
})
