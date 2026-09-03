import { usePanelTranslator } from '../localization'
import { defineComponent, h, onScopeDispose, shallowRef, type PropType } from 'vue'
import { actionFormField, type DashboardFilterStore } from '@holo-js/panels-client'
import { Button } from '../internal-ui'
import { VueSchemaRenderer } from '../schemas/renderer'
import { VueFieldRenderer } from '../fields/renderer'
import type { ComponentRegistry } from '../registry'

export const VueDashboardFilters = defineComponent({
  name: 'VueDashboardFilters',
  props: {
    store: { type: Object as PropType<DashboardFilterStore>, required: true },
    registry: { type: Object as PropType<ComponentRegistry>, required: true },
    panelId: { type: String, required: true },
  },
  setup(props) {
    const translate = usePanelTranslator()
    const state = shallowRef(props.store.form.state)
    onScopeDispose(props.store.form.subscribe(next => { state.value = next }))
    return () => h('form', { 'aria-label': translate('widgets.dashboardFilters'), class: 'hp-dashboard-filters hp:grid hp:gap-4', novalidate: true, onSubmit: (event: Event) => { event.preventDefault(); void props.store.submit() } }, [
      h(VueSchemaRenderer, { panelId: props.panelId, registry: props.registry, schema: props.store.schema, renderContent: ({ component }) => {
        const definition = actionFormField(component)
        return definition ? h(VueFieldRenderer, { field: { definition, optionStore: props.store.optionStore(definition), panelId: props.panelId, registry: props.registry, store: props.store.form } }) : null
      } }),
      h('div', { class: 'hp:flex hp:gap-2' }, [h(Button, { disabled: state.value.submitting, type: 'submit' }, () => translate('tables.applyFilters')), h(Button, { disabled: state.value.submitting, onClick: () => void props.store.submit(true), type: 'button', variant: 'outline' }, () => translate('tables.resetFilters'))]),
      ...state.value.errors._root?.map(message => h('p', { key: message, role: 'alert' }, message)) ?? [],
    ])
  },
})
