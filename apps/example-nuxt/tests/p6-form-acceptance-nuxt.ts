import {
  createComponentRegistry,
  VueFieldRenderer,
  type VueCompiledField,
  type VueFieldRendererProps,
} from '@holo-js/panels-vue'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type {
  FormAcceptanceFixture,
  FormAcceptanceRenderModel,
  FormAcceptanceRenderReport,
} from '../../../packages/testing/src/form-acceptance/index'

function definition(path: string, label: string, type: string): VueCompiledField<Record<string, unknown>> {
  return {
    disabled: false,
    helperText: `${label} for the ${path === 'slug' ? 'generated URL' : 'post'}`,
    hint: null,
    label,
    path,
    placeholder: null,
    properties: {},
    readOnly: false,
    required: true,
    type,
    visible: true,
  }
}

function field(model: FormAcceptanceRenderModel, path: string, label: string, type: string): VueFieldRendererProps<Record<string, unknown>> {
  return {
    collectionStore: type === 'repeater' ? model.sections : undefined,
    createCollectionItem: type === 'repeater' ? () => ({ heading: '' }) : undefined,
    definition: definition(path, label, type),
    optionStore: type === 'select' ? model.cityOptions : undefined,
    registry: createComponentRegistry(),
    renderRepeaterItem: (_value, index) => h('label', [
      `Section ${index + 1} heading`,
      h('input', {
        'aria-invalid': Boolean(model.sections.state.errors[`${index}.heading`]),
        'data-error-path': model.sections.state.errors[`${index}.heading`] ? `${index}.heading` : undefined,
        name: `sections.${index}.heading`,
      }),
    ]),
    store: model.form,
    uploadStore: type === 'panels:field:upload' ? model.uploads : undefined,
  }
}

function fixture(model: FormAcceptanceRenderModel) {
  const fields = [
    field(model, 'title', 'Title', 'text'),
    field(model, 'slug', 'Slug', 'slug'),
    field(model, 'country', 'Country', 'text'),
    field(model, 'city', 'City', 'select'),
    field(model, 'sections', 'Sections', 'repeater'),
    field(model, 'images', 'Images', 'panels:field:upload'),
  ]
  return defineComponent(() => () => h('form', { 'data-acceptance-stage': model.stage },
    fields.map(current => h(VueFieldRenderer, { field: current })),
  ))
}

async function render(model: FormAcceptanceRenderModel): Promise<string> {
  return renderToString(createSSRApp(fixture(model)))
}

export const nuxtFormAcceptanceFixture: FormAcceptanceFixture = {
  framework: 'vue',
  render: async (model): Promise<FormAcceptanceRenderReport> => {
    const markup = await render(model)
    return {
      framework: 'vue',
      markup,
      operation: model.operation,
      ssrStable: markup === await render(model),
      stage: model.stage,
    }
  },
}
