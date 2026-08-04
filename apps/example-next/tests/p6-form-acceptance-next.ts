import { createElement, Fragment, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import {
  createComponentRegistry,
  ReactFieldRenderer,
  type ReactCompiledField,
} from '@holo-js/panels-react'
import type {
  FormAcceptanceFixture,
  FormAcceptanceRenderModel,
  FormAcceptanceRenderReport,
} from '../../../packages/testing/src/form-acceptance/index'

function definition(path: string, label: string, type: string): ReactCompiledField<Record<string, unknown>> {
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

function field(model: FormAcceptanceRenderModel, path: string, label: string, type: string): ReactNode {
  return createElement(ReactFieldRenderer<Record<string, unknown>>, {
    collectionStore: type === 'repeater' ? model.sections : undefined,
    createCollectionItem: type === 'repeater' ? () => ({ heading: '' }) : undefined,
    definition: definition(path, label, type),
    optionStore: type === 'select' ? model.cityOptions : undefined,
    registry: createComponentRegistry(),
    renderRepeaterItem: (_value, index) => createElement('label', null,
      `Section ${index + 1} heading`,
      createElement('input', {
        'aria-invalid': Boolean(model.sections.state.errors[`${index}.heading`]),
        'data-error-path': model.sections.state.errors[`${index}.heading`] ? `${index}.heading` : undefined,
        name: `sections.${index}.heading`,
      }),
    ),
    store: model.form,
    uploadStore: type === 'panels:field:upload' ? model.uploads : undefined,
  })
}

function render(model: FormAcceptanceRenderModel): string {
  return renderToString(createElement('form', { 'data-acceptance-stage': model.stage },
    createElement(Fragment, null,
      field(model, 'title', 'Title', 'text'),
      field(model, 'slug', 'Slug', 'slug'),
      field(model, 'country', 'Country', 'text'),
      field(model, 'city', 'City', 'select'),
      field(model, 'sections', 'Sections', 'repeater'),
      field(model, 'images', 'Images', 'panels:field:upload'),
    ),
  ))
}

export const nextFormAcceptanceFixture: FormAcceptanceFixture = {
  framework: 'react',
  render: async (model): Promise<FormAcceptanceRenderReport> => {
    const markup = render(model)
    return {
      framework: 'react',
      markup,
      operation: model.operation,
      ssrStable: markup === render(model),
      stage: model.stage,
    }
  },
}
