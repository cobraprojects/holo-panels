import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'
import { renderResourceTypeBindings, renderResourceTypeChecks } from '../src/resource-type-bindings'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

function compilerOptions(workspaceRoot: string): ts.CompilerOptions {
  const packageSource = (name: string): string => resolve(workspaceRoot, 'packages', name, 'src/index.ts')
  return {
    baseUrl: workspaceRoot,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    noUncheckedIndexedAccess: true,
    paths: {
      '@holo-js/db': [resolve(workspaceRoot, 'node_modules/@holo-js/db/dist/index.d.ts')],
      '@holo-js/panels-actions': [packageSource('actions')],
      '@holo-js/panels-core': [packageSource('core')],
      '@holo-js/panels-forms': [packageSource('forms')],
      '@holo-js/panels-infolists': [packageSource('infolists')],
      '@holo-js/panels-notifications': [packageSource('notifications')],
      '@holo-js/panels-resources': [packageSource('resources')],
      '@holo-js/panels-schemas': [packageSource('schemas')],
      '@holo-js/panels-tables': [packageSource('tables')],
    },
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  }
}

function languageService(
  project: GeneratedProject,
  source: string,
  overrides: ts.CompilerOptions = {},
): ts.LanguageService {
  const { fileName, projectRoot, workspaceRoot } = project
  const options = { ...compilerOptions(workspaceRoot), ...overrides }
  const sourceFiles = new Set([...ts.sys.readDirectory(projectRoot, ['.ts', '.d.ts']), fileName])

  return ts.createLanguageService({
    fileExists: ts.sys.fileExists,
    getCompilationSettings: () => options,
    getCurrentDirectory: () => projectRoot,
    getDefaultLibFileName: settings => ts.getDefaultLibFilePath(settings),
    getScriptFileNames: () => [...sourceFiles],
    getScriptSnapshot: (path) => {
      if (path === fileName) return ts.ScriptSnapshot.fromString(source)
      const contents = ts.sys.readFile(path)
      return contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents)
    },
    getScriptVersion: () => '1',
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
  })
}

interface GeneratedProject {
  readonly fileName: string
  readonly projectRoot: string
  readonly workspaceRoot: string
}

async function writeGeneratedHoloTypes(projectRoot: string): Promise<void> {
  const generatedRoot = join(projectRoot, '.holo-js/generated')
  await writeFile(join(generatedRoot, 'schema.generated.ts'), `import { column, defineGeneratedTable } from '@holo-js/db'

export const posts = defineGeneratedTable('posts', {
  id: column.id(),
  authorId: column.integer(),
  title: column.string(),
  category: column.string(),
  metadata: column.json<{ label: string }>(),
  published: column.boolean(),
})

export const users = defineGeneratedTable('users', {
  id: column.id(),
  name: column.string(),
  email: column.string(),
  metadata: column.json<{ label: string }>(),
  published: column.boolean(),
  title: column.integer(),
})

export const audits = defineGeneratedTable('audits', {
  id: column.id(),
  metadata: column.json<{ label: string }>(),
})

declare module '@holo-js/db' {
  interface GeneratedSchemaTables {
    readonly posts: typeof posts
    readonly users: typeof users
    readonly audits: typeof audits
  }
}

export {}
`)
  await writeFile(join(generatedRoot, 'model-registry.d.ts'), `import './schema.generated'
import type { EmptyScopeMap, GeneratedSchemaTable, ModelReference } from '@holo-js/db'

declare module '@holo-js/db' {
  interface RegisteredModels {
    readonly Post: ModelReference<GeneratedSchemaTable<'posts'>, EmptyScopeMap>
    readonly User: ModelReference<GeneratedSchemaTable<'users'>, EmptyScopeMap>
    readonly Audit: ModelReference<GeneratedSchemaTable<'audits'>, EmptyScopeMap>
  }
}

export {}
`)
}

async function writeModels(projectRoot: string): Promise<void> {
  const modelRoot = join(projectRoot, 'server/models')
  await writeFile(join(modelRoot, 'Audit.ts'), `import { defineModel } from '@holo-js/db'

export default defineModel('audits')
`)
  await writeFile(join(modelRoot, 'User.ts'), `import { defineModel } from '@holo-js/db'

export default defineModel('users')
`)
  await writeFile(join(modelRoot, 'Post.ts'), `import { belongsTo, defineModel } from '@holo-js/db'
import User from './User'

export default defineModel('posts', {
  relations: { author: belongsTo(() => User, 'authorId') },
})
`)
}

async function writeGeneratedRegistry(projectRoot: string): Promise<void> {
  const generatedRoot = join(projectRoot, '.holo-js/generated')
  await writeFile(join(generatedRoot, 'registry.json'), `${JSON.stringify({
    models: [
      { exportName: 'default', name: 'Post', sourcePath: 'server/models/Post.ts', tableName: 'posts' },
      { exportName: 'default', name: 'User', sourcePath: 'server/models/User.ts', tableName: 'users' },
      { exportName: 'default', name: 'Audit', sourcePath: 'server/models/Audit.ts', tableName: 'audits' },
    ],
    version: 1,
  })}\n`)
}

async function writeResourceBindings(projectRoot: string): Promise<void> {
  const generatedRoot = join(projectRoot, '.holo-js/generated')
  const bindings = await renderResourceTypeBindings(projectRoot, [
    {
      exportName: 'default',
      modelName: 'Post',
      projectPath: 'server/admin/resources/posts/PostResource.ts',
      tableName: 'posts',
    },
    {
      exportName: 'default',
      modelName: 'User',
      projectPath: 'server/admin/resources/users/UserResource.ts',
      tableName: 'users',
    },
    {
      exportName: 'default',
      modelName: 'Audit',
      projectPath: 'server/admin/resources/audits/AuditResource.ts',
      tableName: 'audits',
    },
  ], [])
  await writeFile(join(generatedRoot, 'panels', bindings.path), bindings.contents)
}

async function generatedRelationManagerProject(source: string, relationship = 'author'): Promise<GeneratedProject> {
  const workspaceRoot = resolve(import.meta.dirname, '../../..')
  const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-relation-manager-api-'))
  const fileName = join(projectRoot, 'server/admin/resources/posts/relation-managers/AuthorRelationManager.ts')
  temporaryDirectories.push(projectRoot)
  await Promise.all([
    mkdir(join(projectRoot, '.holo-js/generated/panels'), { recursive: true }),
    mkdir(join(projectRoot, 'server/models'), { recursive: true }),
    mkdir(join(projectRoot, 'server/admin/resources/posts/relation-managers'), { recursive: true }),
  ])
  await Promise.all([
    writeGeneratedHoloTypes(projectRoot),
    writeGeneratedRegistry(projectRoot),
    writeModels(projectRoot),
    writeFile(join(projectRoot, 'server/admin/resources/posts/PostResource.ts'), `import { Resource } from '@holo-js/panels-resources'
import Post from '../../../models/Post'

export default class PostResource extends Resource {
  protected static override model = Post
}
`),
    writeFile(fileName, source),
  ])
  const bindings = await renderResourceTypeBindings(projectRoot, [{
    exportName: 'default',
    modelName: 'Post',
    projectPath: 'server/admin/resources/posts/PostResource.ts',
    tableName: 'posts',
  }], [{
    exportName: 'default',
    ownerResourceExportName: 'default',
    ownerResourceProjectPath: 'server/admin/resources/posts/PostResource.ts',
    projectPath: 'server/admin/resources/posts/relation-managers/AuthorRelationManager.ts',
    relationship,
  }])
  await writeFile(join(projectRoot, '.holo-js/generated/panels', bindings.path), bindings.contents)
  return { fileName, projectRoot, workspaceRoot }
}

async function generatedProject(source: string, resource: 'Audit' | 'Post' | 'User' = 'Post'): Promise<GeneratedProject> {
  const workspaceRoot = resolve(import.meta.dirname, '../../..')
  const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-resource-api-'))
  const resourcePaths = {
    Audit: 'server/admin/resources/audits/AuditResource.ts',
    Post: 'server/admin/resources/posts/PostResource.ts',
    User: 'server/admin/resources/users/UserResource.ts',
  } as const
  const resourceStubs = {
    Audit: `import { Resource } from '@holo-js/panels-resources'
import Audit from '../../../models/Audit'

export default class AuditResource extends Resource {
  protected static override model = Audit
}
`,
    Post: `import { Resource } from '@holo-js/panels-resources'
import Post from '../../../models/Post'

export default class PostResource extends Resource {
  protected static override model = Post
}
`,
    User: `import { Resource } from '@holo-js/panels-resources'
import User from '../../../models/User'

export default class UserResource extends Resource {
  protected static override model = User
}
`,
  } as const
  const fileName = join(projectRoot, resourcePaths[resource])
  temporaryDirectories.push(projectRoot)
  await Promise.all([
    mkdir(join(projectRoot, '.holo-js/generated/panels'), { recursive: true }),
    mkdir(join(projectRoot, 'server/models'), { recursive: true }),
    mkdir(join(projectRoot, 'server/admin/resources/posts'), { recursive: true }),
    mkdir(join(projectRoot, 'server/admin/resources/users'), { recursive: true }),
    mkdir(join(projectRoot, 'server/admin/resources/audits'), { recursive: true }),
  ])
  const resourceFiles = (Object.keys(resourcePaths) as readonly (keyof typeof resourcePaths)[])
    .map(name => writeFile(join(projectRoot, resourcePaths[name]), name === resource ? source : resourceStubs[name]))
  await Promise.all([
    writeGeneratedHoloTypes(projectRoot),
    writeGeneratedRegistry(projectRoot),
    writeModels(projectRoot),
    ...resourceFiles,
  ])
  await writeResourceBindings(projectRoot)
  return { fileName, projectRoot, workspaceRoot }
}

describe('Resource API completions', () => {
  it('offers generated model paths throughout the Resource API', async () => {
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      "  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('')]))",
      "  static destructuredForm = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('')]))",
      "  static infolist = this.configureInfolist((schema, entry) => schema.components([entry.TextEntry.make('')]))",
      "  static table = this.configureTable((table, column) => table.columns([column.TextColumn.make('')]).filters([column.SelectFilter.make('')]))",
      '}',
      '',
    ].join('\n')
    const project = await generatedProject(source)
    const service = languageService(project, source)
    const { fileName } = project

    const completionsAt = (needle: string): readonly string[] => {
      const position = source.indexOf(needle) + needle.length - 2
      const completions = service.getCompletionsAtPosition(fileName, position, {
        includeCompletionsForModuleExports: false,
        includeCompletionsWithInsertText: true,
      })
      return completions?.entries.map(entry => entry.name) ?? []
    }

    const formPaths = completionsAt("field.TextInput.make('')")
    const destructuredFormPaths = completionsAt("TextInput.make('')")
    const infolistPaths = completionsAt("entry.TextEntry.make('')")
    const columnPaths = completionsAt("column.TextColumn.make('')")
    const filterPaths = completionsAt("column.SelectFilter.make('')")

    expect(formPaths).toContain('title')
    expect(formPaths).toContain('author.name')
    expect(formPaths).not.toContain('email')
    expect(destructuredFormPaths).toContain('title')
    expect(destructuredFormPaths).not.toContain('email')
    expect(infolistPaths).toContain('author.name')
    expect(columnPaths).toContain('author.name')
    expect(filterPaths).toContain('category')
  })

  it('rejects fields and action records outside the generated Resource model', async () => {
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      "  static table = this.configureTable((table, { SelectFilter, TernaryFilter, TextColumn }) => table.columns([TextColumn.make('title')]).filters([SelectFilter.make('title'), TernaryFilter.make('published')]))",
      '  static form = this.configureForm((schema, { Select, TextInput }) => {',
      "    Select.make('authorId').relationship('author', 'name')",
      "    TextInput.make('category').disabled(({ record }) => record?.published === true)",
      "    return schema.components([TextInput.make('email')])",
      '  })',
      '  static invalidColumn = this.configureTable((table, { TextColumn }) => {',
      "    return table.columns([TextColumn.make('email')])",
      '  })',
      '  static invalidFilter = this.configureTable((table, { SelectFilter }) => {',
      "    return table.filters([SelectFilter.make('email')])",
      '  })',
      '  static invalidFormRelation = this.configureForm((schema, { Select }) => {',
      "    return schema.components([Select.make('authorId').relationship('metadata', 'label')])",
      '  })',
      '  static invalidTableRelation = this.configureTable((table, { SelectFilter }) => {',
      "    return table.filters([SelectFilter.make('metadata').relationship('metadata', 'label')])",
      '  })',
      "  static publish = this.action(({ Action }) => Action.make('publish')).action((_data, { record }) => {",
      '    if (!record) return null',
      '    const title = record.title',
      '    return record.email ?? title',
      '  })',
      '}',
      '',
    ].join('\n')
    const project = await generatedProject(source)
    const service = languageService(project, source)
    const { fileName } = project
    const diagnostics = service.getSemanticDiagnostics(fileName)
    const messages = diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toHaveLength(6)
    expect(messages.filter(message => message.includes('is not assignable to parameter of type'))).toHaveLength(5)
    expect(messages.filter(message => message.includes('Argument of type \'"metadata"\' is not assignable'))).toHaveLength(2)
    expect(messages.filter(message => message.includes("Property 'email' does not exist"))).toHaveLength(1)
  })

  it('rejects JSON object columns as relations on models without relations', async () => {
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import Audit from '../../../models/Audit'",
      '',
      'export default class AuditResource extends Resource {',
      '  protected static override model = Audit',
      "  static form = this.configureForm((schema, { Select }) => schema.components([Select.make('metadata').relationship('metadata', 'label')]))",
      '}',
      '',
    ].join('\n')
    const project = await generatedProject(source, 'Audit')
    const service = languageService(project, source)
    const messages = service.getSemanticDiagnostics(project.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toEqual([expect.stringContaining('Argument of type \'"metadata"\' is not assignable')])
  })

  it('infers shared-path callbacks from the enclosing Resource', async () => {
    const postSource = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      "  static plainForm = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').required()]))",
      "  static form = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').disabled(({ record }) => record?.category === 'news')]))",
      "  static invalidForm = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').disabled(({ record }) => record?.email !== '')]))",
      "  static plainInfolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').label('Title')]))",
      "  static infolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').visible(({ record }) => record.category === 'news')]))",
      "  static invalidInfolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').visible(({ record }) => record.email !== '')]))",
      "  static plainTable = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').label('Title')]))",
      "  static table = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').tooltip(({ record }) => record.category)]))",
      "  static invalidTable = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').tooltip(({ record }) => record.email)]))",
      '}',
      '',
    ].join('\n')
    const userSource = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import User from '../../../models/User'",
      '',
      'export default class UserResource extends Resource {',
      '  protected static override model = User',
      "  static plainForm = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').required()]))",
      "  static form = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').disabled(({ record }) => record?.email !== '')]))",
      "  static invalidForm = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').disabled(({ record }) => record?.category === 'news')]))",
      "  static plainInfolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').label('Title')]))",
      "  static infolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').visible(({ record }) => record.email !== '')]))",
      "  static invalidInfolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').visible(({ record }) => record.category === 'news')]))",
      "  static plainTable = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').label('Title')]))",
      "  static table = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').tooltip(({ record }) => record.email)]))",
      "  static invalidTable = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').tooltip(({ record }) => record.category)]))",
      '}',
      '',
    ].join('\n')
    const [postProject, userProject] = await Promise.all([
      generatedProject(postSource),
      generatedProject(userSource, 'User'),
    ])
    const postMessages = languageService(postProject, postSource).getSemanticDiagnostics(postProject.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    const userMessages = languageService(userProject, userSource).getSemanticDiagnostics(userProject.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(postMessages).toHaveLength(3)
    expect(postMessages.every(message => message.includes("Property 'email' does not exist"))).toBe(true)
    expect(userMessages).toHaveLength(3)
    expect(userMessages.every(message => message.includes("Property 'category' does not exist"))).toBe(true)
  })

  it('rejects relations owned by another Resource on a shared path', async () => {
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import User from '../../../models/User'",
      '',
      'export default class UserResource extends Resource {',
      '  protected static override model = User',
      "  static form = this.configureForm((schema, { Select }) => schema.components([Select.make('title').relationship('author', 'name')]))",
      "  static infolist = this.configureInfolist((schema, { TextEntry }) => schema.components([TextEntry.make('title').relationship('author', 'name')]))",
      "  static table = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('title').relationship('author', 'name')]))",
      '}',
      '',
    ].join('\n')
    const project = await generatedProject(source, 'User')
    const messages = languageService(project, source).getSemanticDiagnostics(project.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toHaveLength(3)
    expect(messages.every(message => message.includes('Argument of type \'"author"\' is not assignable'))).toBe(true)
  })

  it('infers a shared field value from the enclosing Resource', async () => {
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import User from '../../../models/User'",
      '',
      'export default class UserResource extends Resource {',
      '  protected static override model = User',
      "  static form = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').afterStateUpdated(state => { state?.toFixed() })]))",
      "  static invalidForm = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').default('wrong')]))",
      '}',
      '',
    ].join('\n')
    const project = await generatedProject(source, 'User')
    const diagnostics = languageService(project, source).getSemanticDiagnostics(project.fileName)
    const messages = diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("Argument of type '\"wrong\"' is not assignable")
  })

  it('preserves the Resource record across every built-in field, column, and entry', async () => {
    const formComponents = [
      ['Builder', 'title'],
      ['Checkbox', 'published'],
      ['CheckboxList', 'title'],
      ['CodeEditor', 'title'],
      ['ColorPicker', 'title'],
      ['DatePicker', 'title'],
      ['DateTimePicker', 'title'],
      ['FileUpload', 'title'],
      ['Hidden', 'title'],
      ['KeyValue', 'title'],
      ['MarkdownEditor', 'title'],
      ['Radio', 'title'],
      ['Repeater', 'title'],
      ['RichEditor', 'title'],
      ['Select', 'title'],
      ['Slider', 'title'],
      ['TagsInput', 'title'],
      ['TextInput', 'title'],
      ['Textarea', 'title'],
      ['TimePicker', 'title'],
      ['Toggle', 'published'],
      ['ToggleButtons', 'title'],
    ] as const
    const tableColumns = [
      ['CheckboxColumn', 'published'],
      ['ColorColumn', 'title'],
      ['IconColumn', 'title'],
      ['ImageColumn', 'title'],
      ['SelectColumn', 'title'],
      ['TextColumn', 'title'],
      ['TextInputColumn', 'title'],
      ['ToggleColumn', 'published'],
    ] as const
    const infolistEntries = [
      ['CodeEntry', 'title'],
      ['ColorEntry', 'title'],
      ['IconEntry', 'title'],
      ['ImageEntry', 'title'],
      ['KeyValueEntry', 'title'],
      ['RepeatableEntry', 'title'],
      ['TextEntry', 'title'],
    ] as const
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      `  static form = this.configureForm((schema, field) => schema.components([${formComponents.map(([name, path]) => `field.${name}.make('${path}').disabled(({ record }) => record?.category === 'news')`).join(', ')}]))`,
      `  static infolist = this.configureInfolist((schema, entry) => schema.components([${infolistEntries.map(([name, path]) => `entry.${name}.make('${path}').visible(({ record }) => record.category === 'news')`).join(', ')}]))`,
      `  static table = this.configureTable((table, column) => table.columns([${tableColumns.map(([name, path]) => `column.${name}.make('${path}').tooltip(({ record }) => record.category)`).join(', ')}]))`,
      '}',
      '',
    ].join('\n')
    const project = await generatedProject(source)
    const messages = languageService(project, source).getSemanticDiagnostics(project.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toEqual([])
  })

  it('infers relation-manager paths from the parent Resource relationship', async () => {
    const source = [
      "import { RelationManager } from '@holo-js/panels-resources'",
      '',
      'export default class AuthorRelationManager extends RelationManager {',
      "  protected static override relationship = 'author'",
      "  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('name'), field.TextInput.make('')]))",
      "  static values = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('title').default(1).afterStateUpdated(state => { state?.toFixed() })]))",
      "  static table = this.configureTable((table, { TextColumn }) => table.columns([TextColumn.make('email'), TextColumn.make('')]))",
      "  static inviteAction = this.action(({ Action }) => Action.make('invite')).action((_data, { record }) => record?.metadata.label)",
      "  static invalidAction = this.action(({ Action }) => Action.make('invalid')).action((_data, { record }) => record?.category)",
      "  static invalid = this.configureForm((schema, { TextInput }) => schema.components([TextInput.make('category')]))",
      '}',
      '',
    ].join('\n')
    const project = await generatedRelationManagerProject(source)
    const service = languageService(project, source)
    const completionsAt = (needle: string): readonly string[] => {
      const position = source.indexOf(needle) + needle.length - 2
      return service.getCompletionsAtPosition(project.fileName, position, {
        includeCompletionsForModuleExports: false,
        includeCompletionsWithInsertText: true,
      })?.entries.map(entry => entry.name) ?? []
    }
    const messages = service.getSemanticDiagnostics(project.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(completionsAt("field.TextInput.make('')")).toContain('name')
    expect(completionsAt("field.TextInput.make('')")).toContain('metadata.label')
    expect(completionsAt("TextColumn.make('')")).toContain('email')
    expect(completionsAt("field.TextInput.make('')")).not.toContain('category')
    expect(messages.filter(message => message.includes('"category"'))).toHaveLength(1)
    expect(messages.filter(message => message.includes("Property 'category' does not exist"))).toHaveLength(1)
  })

  it('rejects a relationship outside the generated parent model', async () => {
    const source = [
      "import { RelationManager } from '@holo-js/panels-resources'",
      '',
      'export default class InvalidRelationManager extends RelationManager {',
      "  protected static override relationship = 'category'",
      '}',
      '',
    ].join('\n')
    const project = await generatedRelationManagerProject(source, 'category')
    const checks = await renderResourceTypeChecks(project.projectRoot, [{
      exportName: 'default',
      modelName: 'Post',
      projectPath: 'server/admin/resources/posts/PostResource.ts',
      tableName: 'posts',
    }], [{
      exportName: 'default',
      ownerResourceExportName: 'default',
      ownerResourceProjectPath: 'server/admin/resources/posts/PostResource.ts',
      projectPath: 'server/admin/resources/posts/relation-managers/AuthorRelationManager.ts',
      relationship: 'category',
    }])
    const checkPath = join(project.projectRoot, '.holo-js/generated/panels', checks.path)
    await writeFile(checkPath, checks.contents)
    const service = languageService(project, source)
    const sourceMessages = service.getSemanticDiagnostics(project.fileName)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    const messages = service.getSemanticDiagnostics(checkPath)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(sourceMessages).toEqual([])
    expect(messages).toEqual([expect.stringContaining('Type \'"category"\' does not satisfy the constraint \'"author"\'')])
  })

  it('keeps generated relationship checks valid with unused-local diagnostics enabled', async () => {
    const source = [
      "import { RelationManager } from '@holo-js/panels-resources'",
      '',
      'export default class AuthorRelationManager extends RelationManager {',
      "  protected static override relationship = 'author'",
      '}',
      '',
    ].join('\n')
    const project = await generatedRelationManagerProject(source)
    const checks = await renderResourceTypeChecks(project.projectRoot, [{
      exportName: 'default',
      modelName: 'Post',
      projectPath: 'server/admin/resources/posts/PostResource.ts',
      tableName: 'posts',
    }], [{
      exportName: 'default',
      ownerResourceExportName: 'default',
      ownerResourceProjectPath: 'server/admin/resources/posts/PostResource.ts',
      projectPath: 'server/admin/resources/posts/relation-managers/AuthorRelationManager.ts',
      relationship: 'author',
    }])
    const checkPath = join(project.projectRoot, '.holo-js/generated/panels', checks.path)
    await writeFile(checkPath, checks.contents)
    const diagnostics = languageService(project, source, { noUnusedLocals: true })
      .getSemanticDiagnostics(checkPath)
      .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(diagnostics).toEqual([])
  })

  it('rejects manual record generics on resources and relation managers', async () => {
    const resourceSource = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      '}',
      'class ManuallyTypedResource extends Resource<typeof Post> {}',
      '',
    ].join('\n')
    const relationManagerSource = [
      "import { RelationManager } from '@holo-js/panels-resources'",
      '',
      'export default class AuthorRelationManager extends RelationManager {',
      "  protected static override relationship = 'author'",
      '}',
      'class ManuallyTypedRelationManager extends RelationManager<object, object> {}',
      '',
    ].join('\n')
    const [resourceProject, relationManagerProject] = await Promise.all([
      generatedProject(resourceSource),
      generatedRelationManagerProject(relationManagerSource),
    ])
    const messages = [
      ...languageService(resourceProject, resourceSource).getSemanticDiagnostics(resourceProject.fileName),
      ...languageService(relationManagerProject, relationManagerSource).getSemanticDiagnostics(relationManagerProject.fileName),
    ].map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toEqual([
      "Type 'Resource' is not generic.",
      "Type 'RelationManager' is not generic.",
    ])
  })
})
