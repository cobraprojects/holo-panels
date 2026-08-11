import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component } from 'svelte'
import type { render as renderSvelteComponent } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll } from 'vitest'
import type {
  FormAcceptanceFixture,
  FormAcceptanceRenderModel,
  FormAcceptanceRenderReport,
} from '../../../packages/testing/src/form-acceptance/index'

interface SvelteAcceptanceRuntime {
  readonly FieldRenderer: Component
  readonly renderComponent: typeof renderSvelteComponent
}

let runtimePromise: Promise<SvelteAcceptanceRuntime> | undefined
let viteServer: ViteDevServer | undefined

function definition(path: string, label: string, type: string) {
  return {
    helperText: `${label} for the ${path === 'slug' ? 'generated URL' : 'post'}`,
    label,
    path,
    properties: type === 'repeater' ? { cloneable: true } : {},
    required: true,
    type,
  }
}

function field(
  FieldRenderer: Component,
  renderComponent: typeof renderSvelteComponent,
  model: FormAcceptanceRenderModel,
  path: string,
  label: string,
  type: string,
): string {
  return renderComponent(FieldRenderer, {
    props: {
      collectionStore: type === 'repeater' ? model.sections : undefined,
      definition: definition(path, label, type),
      form: model.form,
      optionStore: type === 'select' ? model.cityOptions : undefined,
      uploadStore: type === 'panels:field:upload' ? model.uploads : undefined,
    },
  }).body
}

function renderFields(FieldRenderer: Component, renderComponent: typeof renderSvelteComponent, model: FormAcceptanceRenderModel): string {
  const fields = [
    field(FieldRenderer, renderComponent, model, 'title', 'Title', 'text'),
    field(FieldRenderer, renderComponent, model, 'slug', 'Slug', 'slug'),
    field(FieldRenderer, renderComponent, model, 'country', 'Country', 'text'),
    field(FieldRenderer, renderComponent, model, 'city', 'City', 'select'),
    field(FieldRenderer, renderComponent, model, 'sections', 'Sections', 'repeater'),
    field(FieldRenderer, renderComponent, model, 'images', 'Images', 'panels:field:upload'),
  ]
  return `<form data-acceptance-stage="${model.stage}">${fields.join('')}</form>`
}

async function acceptanceRuntime(): Promise<SvelteAcceptanceRuntime> {
  if (runtimePromise) return runtimePromise
  runtimePromise = (async () => {
    const rendererRoot = resolve(process.cwd(), '../svelte')
    const server = await createServer({
      appType: 'custom',
      cacheDir: `/tmp/holo-panels-svelte-p6-acceptance-${process.pid}`,
      logLevel: 'silent',
      plugins: [svelte()],
      root: rendererRoot,
      server: { middlewareMode: true },
    })
    viteServer = server
    const rendererModule = await server.ssrLoadModule('/src/index.ts')
    const serverModule = await server.ssrLoadModule('svelte/server')
    return {
      FieldRenderer: rendererModule.FieldRenderer as Component,
      renderComponent: serverModule.render as typeof renderSvelteComponent,
    }
  })().catch(async (error: unknown) => {
    const server = viteServer
    viteServer = undefined
    runtimePromise = undefined
    await server?.close()
    throw error
  })
  return runtimePromise
}

async function render(model: FormAcceptanceRenderModel): Promise<readonly [string, string]> {
  const { FieldRenderer, renderComponent } = await acceptanceRuntime()
  return [
    renderFields(FieldRenderer, renderComponent, model),
    renderFields(FieldRenderer, renderComponent, model),
  ]
}

afterAll(async () => {
  const server = viteServer
  viteServer = undefined
  runtimePromise = undefined
  await server?.close()
})

export const svelteKitFormAcceptanceFixture: FormAcceptanceFixture = {
  framework: 'svelte',
  render: async (model): Promise<FormAcceptanceRenderReport> => {
    const [markup, repeatedMarkup] = await render(model)
    return {
      framework: 'svelte',
      markup,
      operation: model.operation,
      ssrStable: markup === repeatedMarkup,
      stage: model.stage,
    }
  },
}
