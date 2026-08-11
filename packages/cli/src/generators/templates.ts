import type { FrameworkId, GeneratedFile, ModelMetadata } from './types'
import { kebabCase, lowerFirst, pascalCase, pluralPascal } from './naming'

type TemplateContext = {
  readonly framework?: FrameworkId
  readonly guard: string
  readonly isDefault: boolean
  readonly model?: ModelMetadata
  readonly name: string
  readonly panel: string
  readonly panelPath: string
  readonly resource?: string
  readonly split: boolean
}

function panelTemplate(context: TemplateContext): string {
  const defaultCall = context.isDefault ? '\n  .default()' : ''
  return `import { definePanel } from '@holo-js/panels'\n\nexport default definePanel('${context.panel}')${defaultCall}\n  .path('${context.panelPath}')\n  .authGuard('${context.guard}')\n  .login()\n  .discoverResources()\n  .discoverPages()\n  .discoverWidgets()\n  .discoverClusters()\n`
}

function fieldExpression(field: ModelMetadata['fields'][number]): string {
  const required = field.nullable ? '' : '.required()'
  if (field.type === 'boolean') return `field.checkbox('${field.name}')${required}`
  if (field.type === 'date' || field.type === 'datetime') return `field.dateTime('${field.name}')${required}`
  if (field.type === 'number' || field.type === 'integer' || field.type === 'float' || field.type === 'decimal') {
    return `field.text('${field.name}').numeric()${required}`
  }
  return `field.text('${field.name}')${required}`
}

function columnExpression(field: ModelMetadata['fields'][number]): string {
  if (field.type === 'boolean') return `column.boolean('${field.name}')`
  if (field.type === 'date' || field.type === 'datetime') return `column.text('${field.name}').dateTime()`
  if (field.type === 'number' || field.type === 'integer' || field.type === 'float' || field.type === 'decimal') {
    return `column.text('${field.name}').number()`
  }
  return `column.text('${field.name}')`
}

function resourceFiles(context: TemplateContext): readonly GeneratedFile[] {
  const name = context.name
  const plural = pluralPascal(name)
  const directory = `server/${context.panel}/resources/${kebabCase(plural)}`
  const modelImport = context.model?.importPath ?? `~/server/models/${name}`
  const modelImportStatement = context.model?.exportName
    ? `import { ${context.model.exportName} as ${name} } from '${modelImport}'`
    : `import ${name} from '${modelImport}'`
  const fields = context.model?.fields ?? []
  const formBody = fields.length > 0
    ? fields.map(field => `    ${fieldExpression(field)},`).join('\n')
    : `    field.text('name').required(),`
  const tableBody = fields.length > 0
    ? fields.map(field => `    ${columnExpression(field)},`).join('\n')
    : `    column.text('name'),`
  const relationManagers = (context.model?.relations ?? []).map(relation => ({
    path: `${directory}/relation-managers/${pascalCase(relation.name)}RelationManager.ts`,
    contents: `import { defineRelationManager } from '@holo-js/panels'\n${modelImportStatement}\n\nexport default defineRelationManager('${relation.name}', ${name})\n`,
  }))
  if (!context.split) {
    return [{
      path: `${directory}/${name}Resource.ts`,
      contents: `import { defineResource, defineSchema, defineTable } from '@holo-js/panels'\n${modelImportStatement}\n\nconst form = defineSchema(${name})\n  .fields(field => [\n${formBody}\n  ])\n\nconst table = defineTable(${name})\n  .columns(column => [\n${tableBody}\n  ])\n\nexport default defineResource(${name})\n  .form(form)\n  .table(table)\n`,
    }, ...relationManagers]
  }
  return [
    {
      path: `${directory}/${name}Resource.ts`,
      contents: `import { defineResource } from '@holo-js/panels'\n${modelImportStatement}\nimport { ${name}Form } from './schemas/${name}Form'\nimport { ${plural}Table } from './tables/${plural}Table'\n\nexport default defineResource(${name})\n  .form(${name}Form)\n  .table(${plural}Table)\n`,
    },
    {
      path: `${directory}/schemas/${name}Form.ts`,
      contents: `import { defineSchema } from '@holo-js/panels'\n${modelImportStatement}\n\nexport const ${name}Form = defineSchema(${name})\n  .fields(field => [\n${formBody}\n  ])\n`,
    },
    {
      path: `${directory}/tables/${plural}Table.ts`,
      contents: `import { defineTable } from '@holo-js/panels'\n${modelImportStatement}\n\nexport const ${plural}Table = defineTable(${name})\n  .columns(column => [\n${tableBody}\n  ])\n`,
    },
    ...relationManagers,
  ]
}

const SIMPLE_DEFINITIONS = Object.freeze({
  action: ['actions', 'defineAction'],
  cluster: ['clusters', 'defineCluster'],
  exporter: ['exports', 'defineExporter'],
  filter: ['filters', 'defineFilter'],
  'form-field': ['fields', 'defineField'],
  importer: ['imports', 'defineImporter'],
  'infolist-entry': ['entries', 'defineEntry'],
  page: ['pages', 'definePage'],
  'table-column': ['columns', 'defineColumn'],
  widget: ['widgets', 'defineWidget'],
} as const)

type SimpleKind = keyof typeof SIMPLE_DEFINITIONS

function simpleDefinition(kind: SimpleKind, context: TemplateContext): GeneratedFile {
  const [directory, factory] = SIMPLE_DEFINITIONS[kind]
  const identifier = kind === 'infolist-entry'
    ? `app:entry:${kebabCase(context.name.replace(/Entry$/u, ''))}`
    : kebabCase(context.name)
  if (kind === 'importer' || kind === 'exporter') {
    const resource = context.resource ?? ''
    const resourceName = resource.endsWith('Resource') ? resource.slice(0, -'Resource'.length) : resource
    const resourceBuilder = resource.endsWith('Resource') ? resource : `${resource}Resource`
    return {
      path: `server/${context.panel}/${directory}/${context.name}.ts`,
      contents: `import { ${factory} } from '@holo-js/panels'\nimport ${resourceBuilder} from '~/server/${context.panel}/resources/${kebabCase(pluralPascal(resourceName))}/${resourceBuilder}'\n\nexport default ${factory}('${identifier}', ${resourceBuilder})\n`,
    }
  }
  if (kind === 'form-field' || kind === 'infolist-entry' || kind === 'table-column' || kind === 'filter') {
    const extensionKind = kind === 'form-field' ? 'field' : kind === 'infolist-entry' ? 'entry' : kind === 'table-column' ? 'column' : 'filter'
    const extensionName = kebabCase(context.name.replace(/(?:Column|Entry|Field|Filter)$/u, ''))
    return {
      path: `server/${context.panel}/${directory}/${context.name}.ts`,
      contents: `import { ${factory} } from '@holo-js/panels'\n\nexport default ${factory}('${identifier}', String)\n  .label('${context.name}')\n  .renderer('app:${extensionKind}:${extensionName}')\n`,
    }
  }
  return {
    path: `server/${context.panel}/${directory}/${context.name}.ts`,
    contents: `import { ${factory} } from '@holo-js/panels'\n\nexport default ${factory}('${identifier}')\n`,
  }
}

function nestedDefinition(kind: 'relation-manager' | 'resource-page', context: TemplateContext): GeneratedFile {
  const resource = context.resource ?? ''
  const plural = pluralPascal(resource)
  const directory = `server/${context.panel}/resources/${kebabCase(plural)}`
  if (kind === 'relation-manager') {
    const relation = lowerFirst(context.name.replace(/RelationManager$/, ''))
    return {
      path: `${directory}/relation-managers/${context.name}.ts`,
      contents: `import { defineRelationManager } from '@holo-js/panels'\nimport ${resource} from '~/server/models/${resource}'\n\nexport default defineRelationManager('${relation}', ${resource})\n`,
    }
  }
  return {
    path: `${directory}/pages/${context.name}.ts`,
    contents: `import { defineResourcePage } from '@holo-js/panels'\n\nexport default defineResourcePage('${kebabCase(context.name)}')\n`,
  }
}

function rendererFile(kind: SimpleKind, context: TemplateContext): GeneratedFile | undefined {
  if (!context.framework || !['form-field', 'infolist-entry', 'table-column'].includes(kind)) return undefined
  const category = SIMPLE_DEFINITIONS[kind][0]
  const base = `resources/panels/renderers/${context.framework}/${category}/${context.name}`
  const definitionImport = `~/server/${context.panel}/${category}/${context.name}`
  const rendererKind = kind === 'form-field' ? 'Field' : kind === 'infolist-entry' ? 'Entry' : 'Column'
  const valueExpression = kind === 'form-field' ? 'context.value' : kind === 'infolist-entry' ? 'entry.state' : 'value'
  if (context.framework === 'nuxt') {
    return { path: `${base}.vue`, contents: `<script setup lang="ts">\nimport type { VueDefined${rendererKind}RendererProps } from '@holo-js/panels-vue'\nimport definition from '${definitionImport}'\n\ndefineProps<VueDefined${rendererKind}RendererProps<typeof definition>>()\n</script>\n\n<template>\n  <span>{{ ${valueExpression} }}</span>\n</template>\n` }
  }
  if (context.framework === 'sveltekit') {
    const svelteValue = kind === 'infolist-entry' ? 'entry.state' : 'value'
    return { path: `${base}.svelte`, contents: `<script lang="ts">\n  import type { SvelteDefined${rendererKind}RendererProps } from '@holo-js/panels-svelte'\n  import definition from '${definitionImport}'\n\n  let { ${kind === 'infolist-entry' ? 'entry' : 'value'} }: SvelteDefined${rendererKind}RendererProps<typeof definition> = $props()\n</script>\n\n<span>{${svelteValue}}</span>\n` }
  }
  return { path: `${base}.tsx`, contents: `import { defineReact${rendererKind}Renderer } from '@holo-js/panels-react'\nimport definition from '${definitionImport}'\n\nexport const ${context.name} = defineReact${rendererKind}Renderer(definition, props => (\n  <span>{String(props.${valueExpression} ?? '')}</span>\n))\n` }
}

export function renderTemplates(kind: string, context: TemplateContext): readonly GeneratedFile[] {
  if (kind === 'panel') {
    return [{ path: `server/${context.panel}/${context.name}Panel.ts`, contents: panelTemplate(context) }]
  }
  if (kind === 'resource') return resourceFiles(context)
  if (kind === 'relation-manager' || kind === 'resource-page') return [nestedDefinition(kind, context)]
  if (!(kind in SIMPLE_DEFINITIONS)) throw new Error(`[Holo Panels] Unsupported generator: ${kind}.`)
  const simpleKind = kind as SimpleKind
  const definition = simpleDefinition(simpleKind, context)
  const renderer = rendererFile(simpleKind, context)
  return renderer ? [definition, renderer] : [definition]
}
