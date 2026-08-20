import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import { generatorCommands } from '../src/commands'
import { generate, type FrameworkId, type GeneratorKind, type GeneratorProject } from '../src/generators'

const temporaryDirectories: string[] = []
const originalPath = process.env.PATH

async function fixture(framework: FrameworkId = 'next'): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-generators-'))
  temporaryDirectories.push(projectRoot)
  await writeFile(join(projectRoot, 'package.json'), `${JSON.stringify({ dependencies: { [framework === 'next' ? 'next' : framework === 'nuxt' ? 'nuxt' : '@sveltejs/kit']: '1.0.0' } })}\n`)
  return projectRoot
}

function project(framework: FrameworkId = 'next'): GeneratorProject {
  return {
    framework,
    models: [{
      name: 'Post',
      importPath: '~/models/Post',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'published', type: 'boolean' },
        { name: 'publishedAt', type: 'datetime', nullable: true },
      ],
      relations: [{ name: 'comments', target: 'Comment', kind: 'hasMany' }],
      table: 'posts',
    }],
  }
}

async function run(
  projectRoot: string,
  kind: GeneratorKind,
  args: readonly string[],
  flags: Readonly<Record<string, string | boolean | readonly string[]>> = {},
  generatorProject: GeneratorProject = project(),
  prepare: () => Promise<void> = async () => {},
): Promise<readonly string[]> {
  return await generate({ projectRoot, kind, args, flags, project: generatorProject }, { prepare })
}

async function expectGeneratedResourcesToTypecheck(projectRoot: string, files: readonly string[]): Promise<void> {
  const fixtureRoot = join(import.meta.dirname, 'generator-fixtures')
  await mkdir(join(projectRoot, 'models'), { recursive: true })
  await mkdir(join(projectRoot, 'server/models'), { recursive: true })
  const model = await readFile(join(fixtureRoot, 'Post.ts'), 'utf8')
  await writeFile(join(projectRoot, 'models/Post.ts'), model)
  await writeFile(join(projectRoot, 'server/models/Post.ts'), model)
  const declarations = join(fixtureRoot, 'panels.d.ts')
  const program = ts.createProgram({
    rootNames: [...files.map(file => join(projectRoot, file)), declarations],
    options: {
      baseUrl: projectRoot,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      noUncheckedIndexedAccess: true,
      paths: { '~/*': ['./*'] },
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  process.env.PATH = originalPath
  vi.restoreAllMocks()
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe('Holo Panels generators', () => {
  it('generates panel options and runs preparation after the write', async () => {
    const projectRoot = await fixture()
    const observations: string[] = []

    const files = await run(projectRoot, 'panel', ['admin'], {
      default: true,
      guard: 'backoffice',
      path: '/control',
    }, project(), async () => {
      observations.push(await readFile(join(projectRoot, 'server/admin/AdminPanel.ts'), 'utf8'))
    })

    expect(files).toEqual(['server/admin/AdminPanel.ts'])
    expect(observations[0]).toMatchInlineSnapshot(`
      "import { definePanel } from '@holo-js/panels'

      export default definePanel('admin')
        .default()
        .path('/control')
        .authGuard('backoffice')
        .login()
      "
    `)
  })

  it('contributes commands that invoke the existing holo prepare command', async () => {
    const projectRoot = await fixture()
    const binPath = join(projectRoot, 'test-bin')
    const logPath = join(projectRoot, 'holo.log')
    await mkdir(binPath)
    const executable = join(binPath, 'holo')
    await writeFile(executable, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(logPath)}, process.argv.slice(2).join(' '))\n`)
    await chmod(executable, 0o755)
    process.env.PATH = `${binPath}${delimiter}${originalPath ?? ''}`
    const panelCommand = generatorCommands.find(command => command.name === 'make:panel')!

    await panelCommand.run({
      projectRoot,
      args: ['admin'],
      flags: {},
      loadProject: async () => project(),
    })

    expect(await readFile(logPath, 'utf8')).toBe('prepare')
  })

  it('generates compact resources with concrete model metadata', async () => {
    const projectRoot = await fixture()

    const files = await run(projectRoot, 'resource', ['Post'], { panel: 'admin', generate: true })

    expect(files).toEqual([
      'server/admin/resources/posts/PostResource.ts',
      'server/admin/resources/posts/pages/ListPosts.ts',
      'server/admin/resources/posts/pages/CreatePost.ts',
      'server/admin/resources/posts/pages/EditPost.ts',
      'server/admin/resources/posts/pages/ViewPost.ts',
      'server/admin/resources/posts/relation-managers/CommentsRelationManager.ts',
    ])
    expect(await readFile(join(projectRoot, files[0]!), 'utf8')).toMatchInlineSnapshot(`
      "import { Resource } from '@holo-js/panels-resources'
      import Post from '~/models/Post'
      import CreatePost from './pages/CreatePost'
      import EditPost from './pages/EditPost'
      import ListPosts from './pages/ListPosts'
      import ViewPost from './pages/ViewPost'
      import CommentsRelationManager from './relation-managers/CommentsRelationManager'

      export default class PostResource extends Resource {
        protected static override model = Post

        static form = this.configureForm(schema => schema.components(field => [
              field.textInput('title').required(),
              field.checkbox('published').required(),
              field.dateTimePicker('publishedAt'),
          ]))

        static table = this.configureTable(table => table
          .columns(column => [
              column.text('title'),
              column.text('published'),
              column.text('publishedAt').dateTime(),
          ])
          .recordActions(action => [
            action.view(),
            action.edit(),
            action.delete(),
          ])
          .toolbarActions(action => [
            action.group([
              action.deleteBulk(),
            ]),
          ]))

        static getPages() {
          return {
            index: ListPosts.route('/'),
            create: CreatePost.route('/create'),
            view: ViewPost.route('/{record}'),
            edit: EditPost.route('/{record}/edit'),
          }
        }

        static getRelations() {
          return [CommentsRelationManager]
        }
      }
      "
    `)
    expect(await readFile(join(projectRoot, files[1]!), 'utf8')).toMatchInlineSnapshot(`
      "import { ListRecords } from '@holo-js/panels-resources'
      import PostResource from '../PostResource'

      export default class ListPosts extends ListRecords {
        static override get resource() { return PostResource }

        protected override getHeaderActions() {
          return PostResource.actions(action => [action.create()])
        }
      }
      "
    `)
  })

  it('generates an empty type-safe resource when metadata generation is not requested', async () => {
    const projectRoot = await fixture()

    const files = await run(projectRoot, 'resource', ['Post'], { panel: 'admin' })
    const resource = await readFile(join(projectRoot, files[0]!), 'utf8')

    expect(resource).toContain('schema.components(() => [\n\n    ])')
    expect(resource).toContain('.columns(() => [\n\n    ])')
    expect(resource).not.toContain("'name'")
    await expectGeneratedResourcesToTypecheck(projectRoot, files)
  })

  it('loads canonical Holo model and table metadata for generate mode', async () => {
    const projectRoot = await fixture()
    await mkdir(join(projectRoot, '.holo-js/generated'), { recursive: true })
    await mkdir(join(projectRoot, 'server/models'), { recursive: true })
    await writeFile(join(projectRoot, '.holo-js/generated/registry.json'), `${JSON.stringify({
      version: 1,
      paths: { generatedSchema: '.holo-js/generated/schema.generated.ts' },
      models: [{ sourcePath: 'server/models/Post.ts', name: 'Post', tableName: 'posts', prunable: false }],
    })}\n`)
    await writeFile(join(projectRoot, '.holo-js/generated/schema.generated.ts'), `import { column, defineGeneratedTable } from '@holo-js/db'\n\nexport const posts = defineGeneratedTable("posts", {\n  "id": column.id(),\n  "title": column.string(),\n  "published_at": column.timestamp().nullable(),\n})\n`)
    await writeFile(join(projectRoot, 'server/models/Post.ts'), `import { belongsTo, defineModel, hasMany } from '@holo-js/db'\n\nconst relations = {\n  author: belongsTo('User'),\n  comments: hasMany(() => Comment, 'post_id'),\n}\n\nexport default defineModel('posts', { relations })\n`)

    const files = await run(projectRoot, 'resource', ['Post'], { panel: 'admin', generate: true }, {})
    const contents = await readFile(join(projectRoot, files[0]!), 'utf8')

    expect(contents).toContain("import Post from '~/server/models/Post'")
    expect(contents).toContain("field.textInput('id').numeric().required()")
    expect(contents).toContain("field.dateTimePicker('published_at')")
    expect(files).toEqual([
      'server/admin/resources/posts/PostResource.ts',
      'server/admin/resources/posts/pages/ListPosts.ts',
      'server/admin/resources/posts/pages/CreatePost.ts',
      'server/admin/resources/posts/pages/EditPost.ts',
      'server/admin/resources/posts/pages/ViewPost.ts',
      'server/admin/resources/posts/relation-managers/AuthorRelationManager.ts',
      'server/admin/resources/posts/relation-managers/CommentsRelationManager.ts',
    ])
  })

  it('generates split resource files with model-inferred types', async () => {
    const projectRoot = await fixture()

    const files = await run(projectRoot, 'resource', ['Post'], { panel: 'admin', generate: true, split: true })

    expect(files).toEqual([
      'server/admin/resources/posts/PostResource.ts',
      'server/admin/resources/posts/schemas/PostForm.ts',
      'server/admin/resources/posts/tables/PostsTable.ts',
      'server/admin/resources/posts/pages/ListPosts.ts',
      'server/admin/resources/posts/pages/CreatePost.ts',
      'server/admin/resources/posts/pages/EditPost.ts',
      'server/admin/resources/posts/pages/ViewPost.ts',
      'server/admin/resources/posts/relation-managers/CommentsRelationManager.ts',
    ])
    expect(await readFile(join(projectRoot, files[1]!), 'utf8')).toContain('class PostForm')
    expect(await readFile(join(projectRoot, files[1]!), 'utf8')).toContain('static configure = configureResourceForm(Post')
    expect(await readFile(join(projectRoot, files[2]!), 'utf8')).toContain('class PostsTable')
    expect(await readFile(join(projectRoot, files[2]!), 'utf8')).toContain('recordActions(action => [')
  })

  it.each([false, true])('typechecks generated resources with concrete model fields in %s split mode', async (split) => {
    const projectRoot = await fixture()
    const files = await run(projectRoot, 'resource', ['Post'], { panel: 'admin', generate: true, split })
    await expectGeneratedResourcesToTypecheck(projectRoot, files)
  })

  it.each([
    ['next', '.tsx', 'defineReactFieldRenderer'],
    ['nuxt', '.vue', '<template>'],
    ['sveltekit', '.svelte', '<script lang="ts">'],
  ] as const)('generates only the detected %s custom renderer', async (framework, extension, marker) => {
    const projectRoot = await fixture(framework)

    const files = await run(projectRoot, 'form-field', ['MoneyField'], { panel: 'admin' }, project(framework))

    expect(files).toHaveLength(2)
    expect(files[1]).toBe(`resources/panels/renderers/${framework}/fields/MoneyField${extension}`)
    const renderer = await readFile(join(projectRoot, files[1]!), 'utf8')
    expect(renderer).toContain(marker)
    expect(renderer).not.toContain('unknown')
  })

  it.each([
    ['page', 'Dashboard', {}, 'server/admin/pages/Dashboard.ts'],
    ['resource-page', 'EditPost', { resource: 'Post' }, 'server/admin/resources/posts/pages/EditPost.ts'],
    ['relation-manager', 'CommentsRelationManager', { resource: 'Post' }, 'server/admin/resources/posts/relation-managers/CommentsRelationManager.ts'],
    ['widget', 'PostStats', {}, 'server/admin/widgets/PostStats.ts'],
    ['cluster', 'SettingsCluster', {}, 'server/admin/clusters/SettingsCluster.ts'],
    ['importer', 'PostImporter', { resource: 'PostResource' }, 'server/admin/imports/PostImporter.ts'],
    ['exporter', 'PostExporter', { resource: 'PostResource' }, 'server/admin/exports/PostExporter.ts'],
    ['filter', 'PublishedFilter', {}, 'server/admin/filters/PublishedFilter.ts'],
    ['action', 'PublishAction', {}, 'server/admin/actions/PublishAction.ts'],
  ] as const)('generates the %s definition at its conventional path', async (kind, name, extraFlags, expected) => {
    const projectRoot = await fixture()
    const files = await run(projectRoot, kind, [name], { panel: 'admin', ...extraFlags })
    expect(files).toContain(expected)
  })

  it.each([
    ['importer', 'PostImporter', 'defineImporter'],
    ['exporter', 'PostExporter', 'defineExporter'],
  ] as const)('requires a resource builder for the %s generator', async (kind, name, factory) => {
    const projectRoot = await fixture()
    await expect(run(projectRoot, kind, [name], { panel: 'admin' })).rejects.toThrow(`make:${kind} requires --resource`)

    const [file] = await run(projectRoot, kind, [name], { panel: 'admin', resource: 'PostResource' })
    const contents = await readFile(join(projectRoot, file!), 'utf8')
    expect(contents).toContain("import PostResource from '~/server/admin/resources/posts/PostResource'")
    expect(contents).toContain(`${factory}('post-${kind}', PostResource)`)
  })

  it('preserves existing files unless force names the exact target', async () => {
    const projectRoot = await fixture()
    const target = 'server/admin/pages/Dashboard.ts'
    await mkdir(join(projectRoot, 'server/admin/pages'), { recursive: true })
    await writeFile(join(projectRoot, target), 'user source\n')

    await expect(run(projectRoot, 'page', ['Dashboard'], { panel: 'admin' })).rejects.toThrow(`Refusing to overwrite ${target}`)
    expect(await readFile(join(projectRoot, target), 'utf8')).toBe('user source\n')
    await expect(run(projectRoot, 'page', ['Dashboard'], { panel: 'admin', force: true })).rejects.toThrow('--force must name')
    await expect(run(projectRoot, 'page', ['Dashboard'], { panel: 'admin', force: 'server/admin/pages/Other.ts' })).rejects.toThrow('not generated')

    await run(projectRoot, 'page', ['Dashboard'], { panel: 'admin', force: target })
    expect(await readFile(join(projectRoot, target), 'utf8')).toContain("definePage('dashboard')")
  })

  it('removes only newly created files when preparation fails', async () => {
    const projectRoot = await fixture()
    const existing = 'server/admin/resources/posts/PostResource.ts'
    await mkdir(join(projectRoot, 'server/admin/resources/posts'), { recursive: true })
    await writeFile(join(projectRoot, existing), 'user source\n')

    await expect(run(projectRoot, 'resource', ['Post'], {
      panel: 'admin',
      split: true,
      force: existing,
    }, project(), async () => {
      throw new Error('prepare failed')
    })).rejects.toThrow('prepare failed')

    expect(await readFile(join(projectRoot, existing), 'utf8')).toContain('extends Resource')
    await expect(readFile(join(projectRoot, 'server/admin/resources/posts/schemas/PostForm.ts'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(projectRoot, 'server/admin/resources/posts/tables/PostsTable.ts'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects traversal, symlink targets, ambiguous panels, and missing model metadata before writes', async () => {
    const projectRoot = await fixture()
    await expect(run(projectRoot, 'page', ['Dashboard'], { panel: '../outside' })).rejects.toThrow('lower-kebab-case')
    await mkdir(join(projectRoot, 'server'), { recursive: true })
    const external = await mkdtemp(join(tmpdir(), 'holo-panels-generator-external-'))
    temporaryDirectories.push(external)
    await symlink(external, join(projectRoot, 'server/admin'))
    await expect(run(projectRoot, 'page', ['Dashboard'], { panel: 'admin' })).rejects.toThrow('symlinked generator target')

    const cleanRoot = await fixture()
    await expect(run(cleanRoot, 'resource', ['Missing'], { panel: 'admin', generate: true })).rejects.toThrow('No Holo model metadata')
    await expect(run(cleanRoot, 'resource', ['Post'], { panel: 'admin', generate: true }, {
      ...project(),
      models: [{ ...project().models![0]!, importPath: "~/models/Post'\nthrow new Error('injected')" }],
    })).rejects.toThrow('invalid import path')
    await expect(run(cleanRoot, 'page', ['Dashboard'])).rejects.toThrow('No panel found')
  })
})
