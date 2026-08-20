import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const adjacentHoloRoot = resolve(repositoryRoot, '../holo-js')
const holoRoot = resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? adjacentHoloRoot)
const holoScaffoldPath = resolve(holoRoot, 'packages/cli/src/project/scaffold/framework.ts')
const bunExecutable = process.env.HOLO_PANELS_BUN_EXECUTABLE ?? 'bun'

const examples = Object.freeze([
  Object.freeze({ framework: 'next', directory: 'example-next', panelsAdapter: '@holo-js/panels-next', panelsRenderer: '@holo-js/panels-react' }),
  Object.freeze({ framework: 'nuxt', directory: 'example-nuxt', panelsAdapter: '@holo-js/panels-nuxt', panelsRenderer: '@holo-js/panels-vue' }),
  Object.freeze({ framework: 'sveltekit', directory: 'example-sveltekit', panelsAdapter: '@holo-js/panels-sveltekit', panelsRenderer: '@holo-js/panels-svelte' }),
])

export const nextOperationRoutePath = 'app/holo/panels/[panelId]/[operation]/route.ts'

function managedArtifact(body) {
  return `// @holo-panels-managed sha256:${createHash('sha256').update(body).digest('hex')}\n${body}`
}

const catalogDependencies = new Set([
  '@eslint/js',
  '@holo-js/adapter-next',
  '@holo-js/adapter-nuxt',
  '@holo-js/adapter-sveltekit',
  '@holo-js/auth',
  '@holo-js/authorization',
  '@holo-js/cli',
  '@holo-js/config',
  '@holo-js/core',
  '@holo-js/db',
  '@holo-js/db-sqlite',
  '@holo-js/forms',
  '@holo-js/kernel',
  '@holo-js/notifications',
  '@holo-js/security',
  '@holo-js/session',
  '@holo-js/validation',
  '@sveltejs/adapter-node',
  '@sveltejs/kit',
  '@sveltejs/vite-plugin-svelte',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'eslint',
  'esbuild',
  'globals',
  'next',
  'nuxt',
  'react',
  'react-dom',
  'svelte',
  'svelte-check',
  'typescript',
  'typescript-eslint',
  'vite',
  'vue',
  'vue-tsc',
])

const ignoredScaffoldPaths = new Set([
  '.env',
  'bun.lock',
  'next-env.d.ts',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])

const ignoredScaffoldDirectories = new Set([
  '.holo-js',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  'build',
  'node_modules',
  'storage',
])

function toProjectPath(root, location) {
  return relative(root, location).split(sep).join('/')
}

function shouldPreserveScaffoldPath(path) {
  const rootDirectory = path.split('/')[0]
  return !ignoredScaffoldPaths.has(path)
    && !ignoredScaffoldDirectories.has(rootDirectory)
}

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const location = join(directory, entry.name)
    const projectPath = toProjectPath(root, location)
    if (!shouldPreserveScaffoldPath(projectPath)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, location))
      continue
    }

    if (entry.isFile()) {
      files.push(projectPath)
    }
  }

  return files
}

function useCatalogVersions(dependencies) {
  return Object.fromEntries(Object.entries(dependencies ?? {}).map(([name, version]) => [
    name,
    catalogDependencies.has(name) ? 'catalog:' : version,
  ]).sort(([left], [right]) => left.localeCompare(right)))
}

function adaptManifest(source, example) {
  const scripts = { ...source.scripts }
  delete scripts.prepare
  if (example.framework === 'sveltekit') {
    scripts.prepare = 'svelte-kit sync'
  }

  const integrationDependencies = {
    '@holo-js/authorization': 'catalog:',
    ...(example.framework === 'sveltekit'
      ? {
        '@holo-js/auth': 'catalog:',
        '@holo-js/forms': 'catalog:',
        '@holo-js/notifications': 'catalog:',
        '@holo-js/session': 'catalog:',
        '@holo-js/validation': 'catalog:',
      }
      : example.framework === 'next'
        ? {
          '@holo-js/auth': 'catalog:',
          '@holo-js/notifications': 'catalog:',
          '@holo-js/session': 'catalog:',
        }
        : {
          '@holo-js/auth': 'catalog:',
          '@holo-js/notifications': 'catalog:',
          '@holo-js/session': 'catalog:',
        }),
  }
  const dependencies = Object.fromEntries(Object.entries({
    ...useCatalogVersions(source.dependencies),
    ...integrationDependencies,
    '@holo-js/panels': 'workspace:*',
    '@holo-js/panels-resources': 'workspace:*',
    [example.panelsAdapter]: 'workspace:*',
  }).sort(([left], [right]) => left.localeCompare(right)))
  const devDependencies = Object.fromEntries(Object.entries({
    ...useCatalogVersions(source.devDependencies),
    [example.panelsRenderer]: 'workspace:*',
  }).sort(([left], [right]) => left.localeCompare(right)))

  return {
    ...source,
    name: `@holo-panels/${example.directory}`,
    version: '0.0.0',
    private: true,
    scripts,
    dependencies,
    devDependencies,
  }
}

async function activatePanelsPlugin(destination) {
  const path = join(destination, 'config/app.ts')
  const contents = await readFile(path, 'utf8')
  if (contents.includes("'@holo-js/panels'")) return
  const plugins = /plugins\s*:\s*\[([\s\S]*?)\]/u
  const updated = plugins.test(contents)
    ? contents.replace(plugins, (_match, entries) => `plugins: ['@holo-js/panels',${entries.trim() ? ` ${entries.trim()}` : ''}]`)
    : contents.replace('export default defineAppConfig({', "export default defineAppConfig({\n  plugins: ['@holo-js/panels'],")
  if (updated === contents) throw new Error(`Unable to activate @holo-js/panels in ${path}`)
  await writeFile(path, updated)
}

async function adaptFrameworkFiles(destination, example) {
  await activatePanelsPlugin(destination)
  if (example.framework === 'nuxt') {
    await writeFile(join(destination, 'app/app.vue'), '<template>\n  <NuxtPage />\n</template>\n')
  }
  if (example.framework === 'next') {
    const path = join(destination, 'tsconfig.json')
    const config = JSON.parse(await readFile(path, 'utf8'))
    config.compilerOptions = {
      target: config.compilerOptions.target,
      module: config.compilerOptions.module,
      moduleResolution: config.compilerOptions.moduleResolution,
      strict: config.compilerOptions.strict,
      noEmit: config.compilerOptions.noEmit,
      skipLibCheck: config.compilerOptions.skipLibCheck,
      baseUrl: config.compilerOptions.baseUrl,
      jsx: 'react-jsx',
      paths: config.compilerOptions.paths,
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      incremental: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      isolatedModules: true,
      plugins: [{ name: 'next' }],
    }
    config.include = [
      'next-env.d.ts',
      'proxy.ts',
      'app/**/*.ts',
      'app/**/*.tsx',
      'server/**/*.ts',
      'config/**/*.ts',
      'tests/**/*.ts',
      '.holo-js/generated/**/*.ts',
      '.holo-js/generated/**/*.d.ts',
      '.next/types/**/*.ts',
      '.next/dev/types/**/*.ts',
    ]
    config.exclude = ['node_modules']
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`)
    const operationRoute = join(destination, nextOperationRoutePath)
    await mkdir(dirname(operationRoute), { recursive: true })
    const operationBody = [
      "import { createGeneratedNextPanelsRuntime, createPanelOperationRoute } from '@holo-js/panels-next'",
      "import serverRegistry from '../../../../../.holo-js/generated/panels/server-registry'",
      '',
      'const runtime = createGeneratedNextPanelsRuntime(serverRegistry)',
      "const route = createPanelOperationRoute({ panelIds: ['admin'], runtime })",
      '',
      'export const DELETE = route.DELETE',
      'export const GET = route.GET',
      'export const PATCH = route.PATCH',
      'export const POST = route.POST',
      'export const PUT = route.PUT',
      '',
    ].join('\n')
    await writeFile(operationRoute, managedArtifact(operationBody))
    await writeFile(join(destination, 'next.config.ts'), [
      "import type { NextConfig } from 'next'",
      "import { withHolo } from '@holo-js/adapter-next/config'",
      "import { relative, resolve } from 'node:path'",
      '',
      'const localHoloRoot = process.env.HOLO_PANELS_HOLO_JS_ROOT',
      'const localTurbopackTarget = (localRoot: string, target: string) => `./${relative(resolve(import.meta.dirname, \'../../..\'), resolve(localRoot, target))}`',
      '',
      'const nextConfig: NextConfig = withHolo({',
      '  turbopack: {',
      "    root: resolve(import.meta.dirname, '../../..'),",
      '    ...(localHoloRoot',
      '      ? {',
      '          resolveAlias: {',
      "            '@holo-js/auth': localTurbopackTarget(localHoloRoot, 'packages/auth/dist/index.mjs'),",
      "            '@holo-js/core': localTurbopackTarget(localHoloRoot, 'packages/core/dist/index.mjs'),",
      "            '@holo-js/core/runtime': localTurbopackTarget(localHoloRoot, 'packages/core/dist/runtime/index.mjs'),",
      "            '@holo-js/db': localTurbopackTarget(localHoloRoot, 'packages/db/dist/index.mjs'),",
      "            '@holo-js/kernel': localTurbopackTarget(localHoloRoot, 'packages/kernel/dist/index.mjs'),",
      "            '@holo-js/notifications': localTurbopackTarget(localHoloRoot, 'packages/notifications/dist/index.mjs'),",
      "            '@holo-js/security': localTurbopackTarget(localHoloRoot, 'packages/security/dist/index.mjs'),",
      "            '@holo-js/security/client': localTurbopackTarget(localHoloRoot, 'packages/security/dist/client.mjs'),",
      "            '@holo-js/security/next/server': localTurbopackTarget(localHoloRoot, 'packages/security/dist/next/server.mjs'),",
      "            '@holo-js/session': localTurbopackTarget(localHoloRoot, 'packages/session/dist/index.mjs'),",
      "            '@holo-js/storage': localTurbopackTarget(localHoloRoot, 'packages/storage/dist/index.mjs'),",
      "            '@holo-js/storage/runtime': localTurbopackTarget(",
      '              localHoloRoot,',
      "              'packages/storage/dist/runtime/composables/index.mjs',",
      '            ),',
      '          },',
      '        }',
      '      : {}),',
      '  },',
      '  webpack(config) {',
      '    if (!localHoloRoot) return config',
      '    config.resolve ??= {}',
      '    config.resolve.alias = {',
      '      ...config.resolve.alias,',
      "      '@holo-js/auth$': resolve(localHoloRoot, 'packages/auth/dist/index.mjs'),",
      "      '@holo-js/core$': resolve(localHoloRoot, 'packages/core/dist/index.mjs'),",
      "      '@holo-js/core/runtime$': resolve(localHoloRoot, 'packages/core/dist/runtime/index.mjs'),",
      "      '@holo-js/db$': resolve(localHoloRoot, 'packages/db/dist/index.mjs'),",
      "      '@holo-js/kernel$': resolve(localHoloRoot, 'packages/kernel/dist/index.mjs'),",
      "      '@holo-js/notifications$': resolve(localHoloRoot, 'packages/notifications/dist/index.mjs'),",
      "      '@holo-js/security$': resolve(localHoloRoot, 'packages/security/dist/index.mjs'),",
      "      '@holo-js/security/client$': resolve(localHoloRoot, 'packages/security/dist/client.mjs'),",
      "      '@holo-js/security/next/server$': resolve(localHoloRoot, 'packages/security/dist/next/server.mjs'),",
      "      '@holo-js/session$': resolve(localHoloRoot, 'packages/session/dist/index.mjs'),",
      "      '@holo-js/storage$': resolve(localHoloRoot, 'packages/storage/dist/index.mjs'),",
      "      '@holo-js/storage/runtime$': resolve(",
      '        localHoloRoot,',
      "        'packages/storage/dist/runtime/composables/index.mjs',",
      '      ),',
      '    }',
      '    return config',
      '  },',
      '})',
      '',
      'export default nextConfig',
      '',
    ].join('\n'))
  }
  if (example.framework === 'sveltekit') {
    await writeFile(join(destination, 'src/hooks.server.ts'), [
      "import { csrfProtection } from '@holo-js/security/sveltekit/server'",
      "import type { Handle } from '@sveltejs/kit'",
      '',
      'const csrf = csrfProtection()',
      '',
      "export const handle: Handle = input => input.event.url.pathname.startsWith('/holo/panels/')",
      '  ? input.resolve(input.event)',
      '  : csrf(input)',
      '',
    ].join('\n'))
  }
}

async function scaffoldExample(scaffoldRoot, example) {
  const destination = join(scaffoldRoot, example.directory)
  await execFileAsync(bunExecutable, ['--eval', [
    `import { scaffoldProject } from ${JSON.stringify(pathToFileURL(holoScaffoldPath).href)}`,
    'await scaffoldProject(process.env.HOLO_PANELS_SCAFFOLD_DESTINATION, JSON.parse(process.env.HOLO_PANELS_SCAFFOLD_OPTIONS))',
  ].join('\n')], {
    cwd: scaffoldRoot,
    env: {
      ...process.env,
      HOLO_PANELS_SCAFFOLD_DESTINATION: destination,
      HOLO_PANELS_SCAFFOLD_OPTIONS: JSON.stringify({
        databaseDriver: 'sqlite',
        framework: example.framework,
        optionalPackages: ['security'],
        packageManager: 'bun',
        projectName: example.directory,
        storageDefaultDisk: 'local',
      }),
    },
    maxBuffer: 10 * 1024 * 1024,
  })

  const sourceManifest = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'))
  await writeFile(
    join(destination, 'package.json'),
    `${JSON.stringify(adaptManifest(sourceManifest, example), null, 2)}\n`,
  )
  await adaptFrameworkFiles(destination, example)

  return destination
}

export async function createAdaptedExampleScaffolds() {
  await readFile(holoScaffoldPath, 'utf8').catch(() => {
    throw new Error(
      `Unable to read the adjacent Holo scaffold at ${holoScaffoldPath}. Set HOLO_PANELS_HOLO_JS_ROOT to a Holo-JS checkout.`,
    )
  })

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'holo-panels-examples-'))
  const scaffolds = new Map()

  try {
    for (const example of examples) {
      scaffolds.set(example.directory, await scaffoldExample(temporaryRoot, example))
    }

    return {
      examples,
      scaffolds,
      temporaryRoot,
      async cleanup() {
        await rm(temporaryRoot, { recursive: true, force: true })
      },
    }
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true })
    throw error
  }
}

export async function generateExampleFixtures() {
  const generated = await createAdaptedExampleScaffolds()

  try {
    for (const example of generated.examples) {
      const sourceRoot = generated.scaffolds.get(example.directory)
      if (!sourceRoot) {
        throw new Error(`Missing generated scaffold for ${example.directory}`)
      }

      const destinationRoot = resolve(repositoryRoot, 'apps', example.directory)
      for (const path of await collectFiles(sourceRoot)) {
        const source = join(sourceRoot, path)
        const destination = join(destinationRoot, path)
        await mkdir(dirname(destination), { recursive: true })
        await cp(source, destination)
      }
      if (example.framework === 'next') await readFile(join(destinationRoot, nextOperationRoutePath), 'utf8')

      console.log(`Generated ${example.directory} from Holo ${example.framework} scaffold`)
    }
  } finally {
    await generated.cleanup()
  }
}

const isMainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false

if (isMainModule) {
  await generateExampleFixtures()
}
