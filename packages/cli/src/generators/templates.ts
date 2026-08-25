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
  return `import { definePanel } from '@holo-js/panels'\n\nexport default definePanel('${context.panel}')${defaultCall}\n  .path('${context.panelPath}')\n  .authGuard('${context.guard}')\n  .login()\n`
}

function fieldExpression(field: ModelMetadata['fields'][number]): string {
  const required = field.nullable ? '' : '.required()'
  if (field.type === 'boolean') return `Checkbox.make('${field.name}')${required}`
  if (field.type === 'date' || field.type === 'datetime') return `DateTimePicker.make('${field.name}')${required}`
  if (field.type === 'number' || field.type === 'integer' || field.type === 'float' || field.type === 'decimal') {
    return `TextInput.make('${field.name}').numeric()${required}`
  }
  return `TextInput.make('${field.name}')${required}`
}

function columnExpression(field: ModelMetadata['fields'][number]): string {
  if (field.type === 'date' || field.type === 'datetime') return `TextColumn.make('${field.name}').dateTime()`
  if (field.type === 'number' || field.type === 'integer' || field.type === 'float' || field.type === 'decimal') {
    return `TextColumn.make('${field.name}').number()`
  }
  return `TextColumn.make('${field.name}')`
}

function fieldImports(fields: ModelMetadata['fields']): string {
  const imports = new Set<string>()
  for (const field of fields) {
    if (field.type === 'boolean') imports.add('Checkbox')
    else if (field.type === 'date' || field.type === 'datetime') imports.add('DateTimePicker')
    else imports.add('TextInput')
  }
  return imports.size > 0 ? `import { ${[...imports].sort().join(', ')} } from '@holo-js/panels-forms'\n` : ''
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
    ? fields.map(field => `        ${fieldExpression(field)},`).join('\n')
    : ''
  const tableBody = fields.length > 0
    ? fields.map(field => `        ${columnExpression(field)},`).join('\n')
    : ''
  const formFieldImports = fieldImports(fields)
  const tableColumnImport = fields.length > 0 ? "import { TextColumn } from '@holo-js/panels-tables'\n" : ''
  const relationImports = (context.model?.relations ?? [])
    .map(relation => `import ${pascalCase(relation.name)}RelationManager from './relation-managers/${pascalCase(relation.name)}RelationManager'`)
    .join('\n')
  const getRelations = (context.model?.relations ?? []).length > 0
    ? `\n\n  static getRelations() {\n    return [${(context.model?.relations ?? []).map(relation => `${pascalCase(relation.name)}RelationManager`).join(', ')}]\n  }`
    : ''
  const resourcePages = [
    {
      path: `${directory}/pages/List${plural}.ts`,
      contents: `import { CreateAction } from '@holo-js/panels-actions'\nimport { ListRecords } from '@holo-js/panels-resources'\nimport ${name}Resource from '../${name}Resource'\n\nexport default class List${plural} extends ListRecords {\n  static override get resource() { return ${name}Resource }\n\n  protected override getHeaderActions() {\n    return [CreateAction.make()]\n  }\n}\n`,
    },
    {
      path: `${directory}/pages/Create${name}.ts`,
      contents: `import { CreateRecord } from '@holo-js/panels-resources'\nimport ${name}Resource from '../${name}Resource'\n\nexport default class Create${name} extends CreateRecord {\n  static override get resource() { return ${name}Resource }\n}\n`,
    },
    {
      path: `${directory}/pages/Edit${name}.ts`,
      contents: `import { DeleteAction, ViewAction } from '@holo-js/panels-actions'\nimport { EditRecord } from '@holo-js/panels-resources'\nimport ${name}Resource from '../${name}Resource'\n\nexport default class Edit${name} extends EditRecord {\n  static override get resource() { return ${name}Resource }\n\n  protected override getHeaderActions() {\n    return [ViewAction.make(), DeleteAction.make()]\n  }\n}\n`,
    },
    {
      path: `${directory}/pages/View${name}.ts`,
      contents: `import { EditAction } from '@holo-js/panels-actions'\nimport { ViewRecord } from '@holo-js/panels-resources'\nimport ${name}Resource from '../${name}Resource'\n\nexport default class View${name} extends ViewRecord {\n  static override get resource() { return ${name}Resource }\n\n  protected override getHeaderActions() {\n    return [EditAction.make()]\n  }\n}\n`,
    },
  ]
  const pageImports = `import Create${name} from './pages/Create${name}'\nimport Edit${name} from './pages/Edit${name}'\nimport List${plural} from './pages/List${plural}'\nimport View${name} from './pages/View${name}'`
  const getPages = `  static getPages() {\n    return {\n      index: List${plural}.route('/'),\n      create: Create${name}.route('/create'),\n      view: View${name}.route('/{record}'),\n      edit: Edit${name}.route('/{record}/edit'),\n    }\n  }`
  const relationManagers = (context.model?.relations ?? []).map(relation => ({
    path: `${directory}/relation-managers/${pascalCase(relation.name)}RelationManager.ts`,
    contents: `import { RelationManager } from '@holo-js/panels-resources'\n\nexport default class ${pascalCase(relation.name)}RelationManager extends RelationManager {\n  protected static override relationship = '${relation.name}'\n\n  static table = this.configureTable(table => table.columns([]))\n}\n`,
  }))
  if (!context.split) {
    return [{
      path: `${directory}/${name}Resource.ts`,
      contents: `import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'\n${formFieldImports}import { Resource } from '@holo-js/panels-resources'\n${tableColumnImport}${modelImportStatement}\n${pageImports}\n${relationImports}\n\nexport default class ${name}Resource extends Resource {\n  protected static override model = ${name}\n\n  static form = this.configureForm(schema => schema.components([\n${formBody}\n    ]))\n\n  static table = this.configureTable(table => table\n    .columns([\n${tableBody}\n    ])\n    .recordActions([\n      ViewAction.make(),\n      EditAction.make(),\n      DeleteAction.make(),\n    ])\n    .toolbarActions([\n      ActionGroup.make([\n        DeleteBulkAction.make(),\n      ]),\n    ]))\n\n${getPages}${getRelations}\n}\n`,
    }, ...resourcePages, ...relationManagers]
  }
  return [
    {
      path: `${directory}/${name}Resource.ts`,
      contents: `import { Resource } from '@holo-js/panels-resources'\n${modelImportStatement}\n${pageImports}\n${relationImports}\nimport { ${name}Form } from './schemas/${name}Form'\nimport { ${plural}Table } from './tables/${plural}Table'\n\nexport default class ${name}Resource extends Resource {\n  protected static override model = ${name}\n\n  static form = this.configureForm(schema => schema.components(${name}Form))\n  static table = this.configureTable(table => table\n    .columns(${plural}Table.columns)\n    .recordActions(${plural}Table.recordActions)\n    .toolbarActions(${plural}Table.toolbarActions))\n\n${getPages}${getRelations}\n}\n`,
    },
    {
      path: `${directory}/schemas/${name}Form.ts`,
      contents: `${formFieldImports}export const ${name}Form = [\n${formBody}\n]\n`,
    },
    {
      path: `${directory}/tables/${plural}Table.ts`,
      contents: `import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'\n${tableColumnImport}\nexport const ${plural}Table = {\n  columns: [\n${tableBody}\n  ],\n  recordActions: [\n    ViewAction.make(),\n    EditAction.make(),\n    DeleteAction.make(),\n  ],\n  toolbarActions: [\n    ActionGroup.make([\n      DeleteBulkAction.make(),\n    ]),\n  ],\n}\n`,
    },
    ...resourcePages,
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
  if (kind === 'action') {
    return {
      path: `server/${context.panel}/${directory}/${context.name}.ts`,
      contents: `import { Action } from '@holo-js/panels'\n\nexport default Action.make('${identifier}')\n`,
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
      contents: `import { RelationManager } from '@holo-js/panels-resources'\n\nexport default class ${context.name} extends RelationManager {\n  protected static override relationship = '${relation}'\n}\n`,
    }
  }
  return {
    path: `${directory}/pages/${context.name}.ts`,
    contents: `import { Page } from '@holo-js/panels-resources'\nimport ${resource}Resource from '../${resource}Resource'\n\nexport default class ${context.name} extends Page {\n  static override get resource() { return ${resource}Resource }\n}\n`,
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
