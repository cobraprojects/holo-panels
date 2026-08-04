import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build, type Plugin } from 'esbuild'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { planFrameworkArtifacts, printFrameworkArtifactConflicts } from '../../src/framework'

function artifactBody(contents: string): string {
  return contents.slice(contents.indexOf('\n') + 1)
}

function adapterPlugin(): Plugin {
  return {
    name: 'panel-adapter-fixtures',
    setup(context) {
      context.onResolve({ filter: /^@holo-js\/panels-/ }, args => ({ namespace: 'panels-adapter', path: args.path }))
      context.onLoad({ filter: /.*/, namespace: 'panels-adapter' }, (args) => {
        if (args.path === '@holo-js/panels-next/client') {
          return { contents: `export const createNextPanelComponentRegistry = () => ({ source: 'next-client-registry' })\nexport const NextPanelClient = props => props` }
        }
        if (args.path === '@holo-js/panels-next') {
          return { contents: `export const createPanelPage = options => () => options\nexport const createPanelOperationRoute = options => ({ GET: () => options, POST: () => options })` }
        }
        if (args.path === '@holo-js/panels-nuxt/server') return { contents: 'export const createPanelOperationHandler = options => options' }
        return { contents: `export const createPanelPageLoad = options => () => options\nexport const createPanelOperationHandler = options => ({ GET: () => options, POST: () => options })` }
      })
    },
  }
}

async function executeModule(path: string): Promise<Record<string, unknown>> {
  const result = await build({ bundle: true, entryPoints: [path], format: 'esm', platform: 'node', plugins: [adapterPlugin()], write: false })
  const source = result.outputFiles[0]?.text
  if (!source) throw new Error('Generated framework artifact did not compile')
  return await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${crypto.randomUUID()}`) as Record<string, unknown>
}

async function writeFixture(root: string, relativePath: string, contents: string): Promise<string> {
  const path = join(root, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
  return path
}

describe('managed framework artifact planner', () => {
  it.each([
    ['next', ['app/admin/[[...panelsPath]]/page.tsx', 'app/admin/[[...panelsPath]]/panels-client.tsx', 'app/_holo/panels/[panelId]/[operation]/route.ts']],
    ['nuxt', ['pages/admin/[[...panelsPath]].vue', 'server/api/_holo/panels/[panelId]/[operation].ts']],
    ['sveltekit', [
      'src/routes/admin/[...path]/+page.server.ts',
      'src/routes/admin/[...path]/+page.svelte',
      'src/routes/_holo/panels/[panelId]/[operation]/+server.ts',
    ]],
  ] as const)('creates deterministic %s panel and operation templates', (framework, paths) => {
    const plan = planFrameworkArtifacts({
      framework,
      panels: [{ id: 'admin', path: '/admin/' }],
    })

    expect(plan.writes.map(write => write.path).sort()).toEqual([...paths].sort())
    expect(plan.writes.every(write => write.contents.split('\n', 1)[0]?.includes(`@holo-panels-managed sha256:${write.checksum}`))).toBe(true)
    expect(plan.writes.find(write => write.kind === 'operation-endpoint')?.panelIds).toEqual(['admin'])
    expect(plan.ownership.artifacts).toEqual(plan.writes.map(({ contents: _contents, status: _status, ...ownership }) => ownership))
  })

  it('typechecks and executes generated shells with app-owned runtime modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'holo-panels-framework-'))
    try {
      const panels = [{ id: 'staff', path: '/control/staff' }, { id: 'admin', path: '/operations' }]
      const plans = {
        next: planFrameworkArtifacts({ framework: 'next', panels }),
        nuxt: planFrameworkArtifacts({ framework: 'nuxt', panels }),
        sveltekit: planFrameworkArtifacts({ framework: 'sveltekit', panels }),
      }
      const generated = await Promise.all(Object.values(plans).flatMap(plan => plan.writes
        .filter(write => write.path.endsWith('.ts') || write.path.endsWith('.tsx'))
        .map(write => writeFixture(root, write.path, artifactBody(write.contents)))))
      await writeFixture(root, 'server/panels/runtime.ts', `export const panelsRuntime = { source: 'runtime' } as const\n`)
      await writeFixture(root, 'src/lib/server/panels/registry.ts', `export const panelsRegistry = { source: 'registry' } as const\n`)
      await writeFixture(root, '.holo-js/generated/panels/plugin-renderers.ts', `export function registerPanelPluginRenderers<TRegistry>(registry: TRegistry): TRegistry { return registry }\n`)
      const declarations = await writeFixture(root, 'adapters.d.ts', `
declare module '@holo-js/panels-next' {
  type Runtime = { readonly source: 'runtime' }
  export function createPanelPage(options: { readonly client: unknown, readonly panelId: string, readonly runtime: Runtime }): () => object
  export function createPanelOperationRoute(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): { readonly GET: () => object, readonly POST: () => object }
}
declare module '@holo-js/panels-next/client' {
  export interface NextPanelClientProps { readonly payload: object, readonly registry?: object }
  export function createNextPanelComponentRegistry(): object
  export function NextPanelClient(props: NextPanelClientProps): unknown
}
declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, properties: unknown): unknown
  export function jsxs(type: unknown, properties: unknown): unknown
}
declare module '@holo-js/panels-nuxt/server' {
  type Runtime = { readonly source: 'runtime' }
  export function createPanelOperationHandler(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): object
}
declare module '@holo-js/panels-sveltekit/server' {
  type Registry = { readonly source: 'registry' }
  export function createPanelPageLoad(options: { readonly panelId: string, readonly registry: Registry }): () => object
  export function createPanelOperationHandler(options: { readonly panelIds: readonly string[], readonly registry: Registry }): { readonly GET: () => object, readonly POST: () => object }
}
`)
      const program = ts.createProgram({
        rootNames: [...generated, declarations],
        options: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true, noUncheckedIndexedAccess: true, skipLibCheck: true, strict: true, target: ts.ScriptTarget.ES2022 },
      })
      expect(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])

      const nextEndpointPath = join(root, plans.next.writes.find(write => write.kind === 'operation-endpoint')!.path)
      const nextEndpoint = await executeModule(nextEndpointPath)
      const nextOptions = (nextEndpoint.GET as () => { readonly panelIds: readonly string[], readonly runtime: { readonly source: string } })()
      expect(nextOptions).toEqual({ panelIds: ['staff', 'admin'], runtime: { source: 'runtime' } })
      const nextPagePath = join(root, plans.next.writes.find(write => write.kind === 'panel-page')!.path)
      const nextPage = await executeModule(nextPagePath)
      expect((nextPage.default as () => object)()).toMatchObject({ runtime: { source: 'runtime' } })

      const nuxtEndpointPath = join(root, plans.nuxt.writes.find(write => write.kind === 'operation-endpoint')!.path)
      const nuxtEndpoint = await executeModule(nuxtEndpointPath)
      expect(nuxtEndpoint.default).toEqual({ panelIds: ['staff', 'admin'], runtime: { source: 'runtime' } })

      const svelteEndpointPath = join(root, plans.sveltekit.writes.find(write => write.kind === 'operation-endpoint')!.path)
      const svelteEndpoint = await executeModule(svelteEndpointPath)
      expect((svelteEndpoint.POST as () => object)()).toEqual({ panelIds: ['staff', 'admin'], registry: { source: 'registry' } })
      const sveltePagePath = join(root, plans.sveltekit.writes.find(write => write.path.endsWith('+page.server.ts'))!.path)
      const sveltePage = await executeModule(sveltePagePath)
      expect((sveltePage.load as () => object)()).toMatchObject({ registry: { source: 'registry' } })

      expect(plans.nuxt.writes.find(write => write.path.endsWith('.vue'))?.contents).toContain("panelId: 'staff'")
      expect(plans.next.writes.find(write => write.path.endsWith('panels-client.tsx'))?.contents).toContain('registerPanelPluginRenderers(createNextPanelComponentRegistry())')
      expect(plans.nuxt.writes.find(write => write.path.endsWith('.vue'))?.contents).toContain('registerPanelPluginRenderers(createNuxtPanelComponentRegistry())')
      expect(plans.sveltekit.writes.find(write => write.path.endsWith('.svelte'))?.contents).toContain('registerPanelPluginRenderers(createSvelteKitPanelComponentRegistry())')
      expect(plans.sveltekit.writes.find(write => write.path.endsWith('.svelte'))?.contents).toContain('<PanelPage {data} {registry} />')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  it('includes every discovered non-overlapping panel path in deterministic order', () => {
    const plan = planFrameworkArtifacts({
      framework: 'next',
      panels: [
        { id: 'staff', path: 'staff' },
        { id: 'admin', path: '/admin' },
      ],
    })

    expect(plan.writes.map(write => write.path)).toEqual([
      'app/_holo/panels/[panelId]/[operation]/route.ts',
      'app/admin/[[...panelsPath]]/page.tsx',
      'app/admin/[[...panelsPath]]/panels-client.tsx',
      'app/staff/[[...panelsPath]]/page.tsx',
      'app/staff/[[...panelsPath]]/panels-client.tsx',
    ])
    expect(plan.writes[0]?.panelIds).toEqual(['admin', 'staff'])
  })

  it.each([
    [[{ id: 'admin', path: '/admin' }, { id: 'staff', path: '/admin/staff' }]],
    [[{ id: 'root', path: '/' }, { id: 'admin', path: '/admin' }]],
    [[{ id: 'admin', path: '/admin/' }, { id: 'staff', path: 'admin' }]],
  ])('rejects cross-panel path overlap', (panels) => {
    expect(() => planFrameworkArtifacts({ framework: 'next', panels })).toThrow('Panel paths overlap')
  })

  it('refuses an unmanaged target and emits the complete manual integration snippet', () => {
    const initial = planFrameworkArtifacts({ framework: 'nuxt', panels: [{ id: 'admin', path: '/admin' }] })
    const target = initial.writes[0]!
    const plan = planFrameworkArtifacts({
      framework: 'nuxt',
      panels: [{ id: 'admin', path: '/admin' }],
      existingArtifacts: [{ path: target.path, contents: 'user owned\n' }],
    })

    expect(plan.writes.some(write => write.path === target.path)).toBe(false)
    expect(plan.conflicts).toContainEqual({
      path: target.path,
      reason: 'unmanaged-file',
      integrationSnippet: `Manual integration required for ${target.path}:\n\n${target.contents}`,
    })
    const output: string[] = []
    printFrameworkArtifactConflicts(plan, message => output.push(message))
    expect(output).toEqual([`Manual integration required for ${target.path}:\n\n${target.contents}\n`])
  })

  it('does not claim a matching file without an ownership record', () => {
    const initial = planFrameworkArtifacts({ framework: 'next', panels: [{ id: 'admin', path: '/admin' }] })
    const page = initial.writes.find(write => write.kind === 'panel-page')!
    const plan = planFrameworkArtifacts({
      framework: 'next',
      panels: [{ id: 'admin', path: '/admin' }],
      existingArtifacts: [{ path: page.path, contents: page.contents }],
    })

    expect(plan.conflicts).toContainEqual(expect.objectContaining({ path: page.path, reason: 'unmanaged-file' }))
    expect(plan.ownership.artifacts.some(artifact => artifact.path === page.path)).toBe(false)
  })

  it('updates an owned file only while its recorded checksum and contents match', () => {
    const initial = planFrameworkArtifacts({ framework: 'next', panels: [{ id: 'admin', path: '/admin' }] })
    const endpoint = initial.writes.find(write => write.kind === 'operation-endpoint')!
    const updated = planFrameworkArtifacts({
      framework: 'next',
      panels: [
        { id: 'admin', path: '/admin' },
        { id: 'staff', path: '/staff' },
      ],
      existingArtifacts: [{ path: endpoint.path, contents: endpoint.contents }],
      previousOwnership: initial.ownership,
    })

    expect(updated.writes).toContainEqual(expect.objectContaining({ path: endpoint.path, status: 'update', panelIds: ['admin', 'staff'] }))

    const modified = planFrameworkArtifacts({
      framework: 'next',
      panels: [
        { id: 'admin', path: '/admin' },
        { id: 'staff', path: '/staff' },
      ],
      existingArtifacts: [{ path: endpoint.path, contents: `${endpoint.contents}user change\n` }],
      previousOwnership: initial.ownership,
    })
    expect(modified.conflicts).toContainEqual(expect.objectContaining({ path: endpoint.path, reason: 'managed-file-modified' }))
    expect(modified.writes.some(write => write.path === endpoint.path)).toBe(false)
  })

  it('leaves current managed files unchanged', () => {
    const initial = planFrameworkArtifacts({ framework: 'sveltekit', panels: [{ id: 'admin', path: '/admin' }] })
    const current = planFrameworkArtifacts({
      framework: 'sveltekit',
      panels: [{ id: 'admin', path: '/admin' }],
      existingArtifacts: initial.writes.map(write => ({ path: write.path, contents: write.contents })),
      previousOwnership: initial.ownership,
    })

    expect(current.writes).toEqual([])
    expect(current.conflicts).toEqual([])
    expect(current.unchanged).toEqual(initial.ownership.artifacts)
  })

  it.each(['/Admin', '/admin?', '/../admin', '/admin\\staff'])('rejects unsafe panel path %s', (path) => {
    expect(() => planFrameworkArtifacts({
      framework: 'next',
      panels: [{ id: 'admin', path }],
    })).toThrow('Invalid path')
  })

  it('rejects a panel path that shadows internal operations', () => {
    expect(() => planFrameworkArtifacts({
      framework: 'nuxt',
      panels: [{ id: 'internal', path: '/_holo/panels' }],
    })).toThrow('reserved /_holo path')
  })
})
