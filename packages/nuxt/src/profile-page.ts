import { executePanelAuthRequest, panelContentWidthValue } from '@holo-js/panels-vue'
import { defineComponent, h, onMounted, ref } from 'vue'
import { nuxtPanelAuthAppearanceVariables } from './auth-appearance'
import { useNuxtPanelAuthPresentation } from './auth-presentation'
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, Checkbox, Field, FieldGroup, FieldLabel, Input } from './internal-ui'

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function label(field: string): string {
  return field.replaceAll('_', ' ').replace(/\b\w/gu, letter => letter.toUpperCase())
}

function inputType(field: string, value: unknown): 'email' | 'number' | 'text' {
  if (typeof value === 'number') return 'number'
  return field === 'email' ? 'email' : 'text'
}

export const PanelProfilePage = defineComponent({
  name: 'PanelProfilePage',
  props: {
    panelId: { required: true, type: String },
  },
  setup(props) {
    const values = ref<Readonly<Record<string, unknown>>>({})
    const error = ref('')
    const saved = ref(false)
    const presentation = useNuxtPanelAuthPresentation(props.panelId)
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
    return () => {
      if (!presentation.value) return h('main', { class: 'hp-auth-page', 'data-holo-panel': '' }, [h(Card, { class: 'hp-auth-card hp:h-80 hp:animate-pulse' })])
      const { appearance, brandName, simplePageMaxContentWidth, theme } = presentation.value
      const fields = Object.entries(values.value).map(([field, value]) => h(Field, { key: field }, () => [
        h(FieldLabel, { for: `${props.panelId}-${field}` }, () => label(field)),
        typeof value === 'boolean'
          ? h(Checkbox, { id: `${props.panelId}-${field}`, modelValue: value, name: field, 'onUpdate:modelValue': (next: boolean | 'indeterminate') => { values.value = { ...values.value, [field]: next === true } } })
          : h(Input, { autocomplete: field === 'email' ? 'email' : field === 'name' ? 'name' : undefined, id: `${props.panelId}-${field}`, modelValue: typeof value === 'number' || typeof value === 'string' ? value : '', name: field, 'onUpdate:modelValue': (next: string | number) => { values.value = { ...values.value, [field]: typeof value === 'number' ? Number(next) : String(next) } }, type: inputType(field, value) }),
      ]))
      const card = h(Card, { class: 'hp-auth-card' }, () => [
        h(CardHeader, {}, () => [h(CardDescription, {}, () => brandName), h('h1', { class: 'hp:text-2xl hp:font-semibold hp:leading-none' }, 'Profile'), h(CardDescription, {}, () => 'Manage your account information.')]),
        h(CardContent, {}, () => h('form', { onSubmit: (event: Event) => { event.preventDefault(); void save() } }, [h(FieldGroup, {}, () => [
          ...fields,
          error.value ? h(Alert, { variant: 'destructive' }, () => h(AlertDescription, {}, () => error.value)) : null,
          saved.value ? h(Alert, {}, () => h(AlertDescription, {}, () => 'Profile saved.')) : null,
          h(Button, { type: 'submit' }, () => 'Save changes'),
        ])])),
      ])
      return h('main', { class: 'hp-auth-page', 'data-density': appearance.density, 'data-holo-panel': '', 'data-theme': theme, style: { ...nuxtPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } }, [card])
    }
  },
})
