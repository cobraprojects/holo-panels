import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'
import { renderResourceTypeBindings } from '../src/resource-type-bindings'

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
): ts.LanguageService {
  const { fileName, projectRoot, workspaceRoot } = project
  const options = compilerOptions(workspaceRoot)
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
  published: column.boolean(),
  title: column.string(),
})

declare module '@holo-js/db' {
  interface GeneratedSchemaTables {
    readonly posts: typeof posts
    readonly users: typeof users
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
  }
}

export {}
`)
}

async function writeModels(projectRoot: string): Promise<void> {
  const modelRoot = join(projectRoot, 'server/models')
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
  ], [])
  await writeFile(join(generatedRoot, 'panels', bindings.path), bindings.contents)
}

async function generatedProject(source: string): Promise<GeneratedProject> {
  const workspaceRoot = resolve(import.meta.dirname, '../../..')
  const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-resource-api-'))
  const fileName = join(projectRoot, 'server/admin/resources/posts/PostResource.ts')
  temporaryDirectories.push(projectRoot)
  await Promise.all([
    mkdir(join(projectRoot, '.holo-js/generated/panels'), { recursive: true }),
    mkdir(join(projectRoot, 'server/models'), { recursive: true }),
    mkdir(join(projectRoot, 'server/admin/resources/posts'), { recursive: true }),
    mkdir(join(projectRoot, 'server/admin/resources/users'), { recursive: true }),
  ])
  await Promise.all([
    writeGeneratedHoloTypes(projectRoot),
    writeGeneratedRegistry(projectRoot),
    writeModels(projectRoot),
    writeFile(fileName, source),
    writeFile(join(projectRoot, 'server/admin/resources/users/UserResource.ts'), `import { Resource } from '@holo-js/panels-resources'
import User from '../../../models/User'

export default class UserResource extends Resource {
  protected static override model = User
}
`),
  ])
  await writeResourceBindings(projectRoot)
  return { fileName, projectRoot, workspaceRoot }
}

describe('Resource API completions', () => {
  it('offers generated model paths throughout the Resource API', async () => {
    const source = [
      "import { Resource } from '@holo-js/panels-resources'",
      "import { TextInput } from '@holo-js/panels-forms'",
      "import { TextEntry } from '@holo-js/panels-infolists'",
      "import { SelectFilter, TextColumn } from '@holo-js/panels-tables'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      "  static form = this.configureForm(schema => schema.components([TextInput.make('')]))",
      "  static infolist = this.configureInfolist(schema => schema.components([TextEntry.make('')]))",
      "  static table = this.configureTable(table => table.columns([TextColumn.make('')]).filters([SelectFilter.make('')]))",
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

    const formPaths = completionsAt("TextInput.make('')")
    const infolistPaths = completionsAt("TextEntry.make('')")
    const columnPaths = completionsAt("TextColumn.make('')")
    const filterPaths = completionsAt("SelectFilter.make('')")

    expect(formPaths).toContain('title')
    expect(formPaths).toContain('author.name')
    expect(infolistPaths).toContain('author.name')
    expect(columnPaths).toContain('author.name')
    expect(filterPaths).toContain('category')
  })

  it('rejects fields and action records outside the generated Resource model', async () => {
    const source = [
      "import { Action } from '@holo-js/panels-actions'",
      "import { Select, TextInput } from '@holo-js/panels-forms'",
      "import { Resource } from '@holo-js/panels-resources'",
      "import { SelectFilter, TernaryFilter, TextColumn } from '@holo-js/panels-tables'",
      "import Post from '../../../models/Post'",
      '',
      'export default class PostResource extends Resource {',
      '  protected static override model = Post',
      "  static table = this.configureTable(table => table.columns([TextColumn.make('title')]).filters([SelectFilter.make('title'), TernaryFilter.make('published')]))",
      '  static form = this.configureForm((schema) => {',
      "    Select.make('authorId').relationship('author', 'name')",
      "    TextInput.make('category').disabled(({ record }) => record?.published === true)",
      "    return schema.components([TextInput.make('email')])",
      '  })',
      '  static invalidColumn = this.configureTable((table) => {',
      "    return table.columns([TextColumn.make('email')])",
      '  })',
      '  static invalidFilter = this.configureTable((table) => {',
      "    return table.filters([SelectFilter.make('email')])",
      '  })',
      '  static invalidFormRelation = this.configureForm((schema) => {',
      "    return schema.components([Select.make('authorId').relationship('metadata', 'label')])",
      '  })',
      '  static invalidTableRelation = this.configureTable((table) => {',
      "    return table.filters([SelectFilter.make('metadata').relationship('metadata', 'label')])",
      '  })',
      "  static publish = this.action(Action.make('publish')).action((_data, { record }) => {",
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
    expect(messages.slice(0, 3).every(message => message.includes('"email"') && message.includes('not assignable'))).toBe(true)
    expect(messages.slice(3, 5)).toEqual([
      expect.stringContaining('Argument of type \'"metadata"\' is not assignable'),
      expect.stringContaining('Argument of type \'"metadata"\' is not assignable'),
    ])
    expect(messages[5]).toContain("Property 'email' does not exist")
  })
})
