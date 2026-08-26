import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build, type Plugin } from 'esbuild'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { planFrameworkArtifacts, printFrameworkArtifactConflicts } from '../../src/framework'

const nuxtDirectories = Object.freeze({ pages: 'app/pages', server: 'server' })

function artifactBody(contents: string): string {
  return contents.slice(contents.indexOf('\n') + 1)
}

function adapterPlugin(): Plugin {
  return {
    name: 'panel-adapter-fixtures',
    setup(context) {
      context.onResolve({ filter: /theme\.css$/ }, args => ({ namespace: 'panel-theme', path: args.path }))
      context.onLoad({ filter: /.*/, namespace: 'panel-theme' }, () => ({ contents: '' }))
      context.onResolve({ filter: /^@holo-js\/panels-/ }, args => ({ namespace: 'panels-adapter', path: args.path }))
      context.onLoad({ filter: /.*/, namespace: 'panels-adapter' }, (args) => {
        if (args.path === '@holo-js/panels-next/client') {
          return { contents: `export const createNextPanelComponentRegistry = () => ({ source: 'next-client-registry' })\nexport const NextPanelClient = props => props` }
        }
        if (args.path === '@holo-js/panels-next') {
          return { contents: `export const createGeneratedNextPanelsRuntime = registry => ({ registry, source: 'generated-runtime' })\nexport const createPanelPage = options => () => options\nexport const createPanelOperationRoute = options => ({ DELETE: () => options, GET: () => options, PATCH: () => options, POST: () => options, PUT: () => options })` }
        }
        if (args.path === '@holo-js/panels-next/server') return { contents: `export const createGeneratedNextPanelsRuntime = registry => ({ registry, source: 'generated-runtime' })\nexport const createPanelAuthRoute = options => ({ GET: () => options, POST: () => options })\nexport const createPanelTenantRoute = options => ({ GET: () => options, POST: () => options })` }
        if (args.path === '@holo-js/panels-nuxt') return { contents: '' }
        if (args.path === '@holo-js/panels-nuxt/server') return { contents: `export const createGeneratedNuxtPanelsRuntime = registry => ({ registry, source: 'generated-runtime' })\nexport const createPanelOperationHandler = options => options\nexport const createPanelAuthHandler = options => options\nexport const createPanelTenantHandler = options => options` }
        if (args.path === '@holo-js/panels-sveltekit') return { contents: `export const createGeneratedSvelteKitPanelsRegistry = registry => ({ registry, source: 'generated-registry-runtime' })` }
        if (args.path === '@holo-js/panels-sveltekit/server') return { contents: `export const createGeneratedSvelteKitPanelsRegistry = registry => ({ registry, source: 'generated-registry-runtime' })\nexport const createPanelPageLoad = options => () => options\nexport const createPanelOperationHandler = options => ({ GET: () => options, POST: () => options })\nexport const createPanelAuthHandler = options => ({ GET: () => options, POST: () => options })\nexport const createPanelTenantHandler = options => ({ GET: () => options, POST: () => options })` }
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
    ['next', ['app/admin/[[...panelsPath]]/page.tsx', 'app/admin/[[...panelsPath]]/panels-client.tsx', 'app/holo/panels/[panelId]/[operation]/route.ts', 'app/holo/panels/[panelId]/auth/[operation]/route.ts', 'app/holo/panels/[panelId]/tenant/[operation]/route.ts']],
    ['nuxt', ['app/pages/admin/[[...panelsPath]].vue', 'server/routes/holo/panels/[panelId]/[operation].ts', 'server/routes/holo/panels/[panelId]/auth/[operation].ts', 'server/routes/holo/panels/[panelId]/tenant/[operation].ts']],
    ['sveltekit', [
      'src/routes/admin/[...path]/+page.server.ts',
      'src/routes/admin/[...path]/+page.svelte',
      'src/routes/holo/panels/[panelId]/[operation]/+server.ts',
      'src/routes/holo/panels/[panelId]/auth/[operation]/+server.ts',
      'src/routes/holo/panels/[panelId]/tenant/[operation]/+server.ts',
    ]],
  ] as const)('creates deterministic %s panel and operation templates', (framework, paths) => {
    const plan = planFrameworkArtifacts({
      ...(framework === 'nuxt' ? { directories: nuxtDirectories } : {}),
      framework,
      panels: [{ id: 'admin', path: '/admin/' }],
    })

    expect(plan.writes.map(write => write.path).sort()).toEqual([...paths].sort())
    expect(plan.writes.every(write => write.contents.split('\n', 1)[0]?.includes(`@holo-panels-managed sha256:${write.checksum}`))).toBe(true)
    expect(plan.writes.find(write => write.kind === 'operation-endpoint')?.panelIds).toEqual(['admin'])
    expect(plan.ownership.artifacts).toEqual(plan.writes.map(({ contents: _contents, status: _status, ...ownership }) => ownership))
  })

  it.each([
    ['nuxt', 'server/routes/admin/reports/[report].ts'],
    ['sveltekit', 'src/routes/admin/reports/[report]/+server.ts'],
  ] as const)('mounts custom panel routes in the configured %s router directories', (framework, expectedPath) => {
    const plan = planFrameworkArtifacts({
      ...(framework === 'nuxt' ? { directories: nuxtDirectories } : {}),
      framework,
      panels: [{
        id: 'admin',
        path: '/admin',
        routes: [{ domain: null, method: 'GET', scope: 'authenticated', source: '/admin/reports/:report' }],
      }],
    })

    expect(plan.writes.find(write => write.path === expectedPath)).toMatchObject({ kind: 'operation-endpoint', panelIds: ['admin'] })
  })

  it('typechecks and executes generated shells with framework-owned runtime integration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'holo-panels-framework-'))
    try {
      const panels = [{ id: 'staff', path: '/control/staff' }, { id: 'admin', path: '/operations' }]
      const plans = {
        next: planFrameworkArtifacts({ framework: 'next', panels }),
        nuxt: planFrameworkArtifacts({ directories: nuxtDirectories, framework: 'nuxt', panels }),
        sveltekit: planFrameworkArtifacts({ framework: 'sveltekit', panels }),
      }
      const generated = await Promise.all(Object.values(plans).flatMap(plan => plan.writes
        .filter(write => write.path.endsWith('.ts') || write.path.endsWith('.tsx'))
        .map(write => writeFixture(root, write.path, artifactBody(write.contents)))))
      await writeFixture(root, 'server/panels/runtime.ts', `export const panelsRuntime = { source: 'runtime' } as const\n`)
      await writeFixture(root, 'src/lib/server/panels/registry.ts', `export const panelsRegistry = { source: 'registry' } as const\n`)
      await writeFixture(root, '.holo-js/generated/panels/server-registry.ts', `export default { source: 'generated-registry' } as const\n`)
      await writeFixture(root, '.holo-js/generated/panels/plugin-renderers.ts', `export function registerPanelPluginRenderers<TRegistry>(registry: TRegistry): TRegistry { return registry }\n`)
      await writeFixture(root, '.holo-js/generated/panels/application-renderers.ts', `export function registerPanelApplicationRenderers<TRegistry>(registry: TRegistry): TRegistry { return registry }\n`)
      await writeFixture(root, '.holo-js/generated/panels/theme.css', `@layer hp-panels {}\n`)
      const declarations = await writeFixture(root, 'adapters.d.ts', `
declare module '@holo-js/panels-next' {
  type Runtime = { readonly registry: { readonly source: 'generated-registry' }, readonly source: 'generated-runtime' }
  export function createGeneratedNextPanelsRuntime(registry: { readonly source: 'generated-registry' }): Runtime
  export function createPanelPage(options: { readonly client: unknown, readonly panelId: string, readonly runtime: Runtime }): () => object
  export function createPanelOperationRoute(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): { readonly DELETE: () => object, readonly GET: () => object, readonly PATCH: () => object, readonly POST: () => object, readonly PUT: () => object }
}
declare module '@holo-js/panels-next/server' {
  type Runtime = { readonly registry: { readonly source: 'generated-registry' }, readonly source: 'generated-runtime' }
  export function createGeneratedNextPanelsRuntime(registry: { readonly source: 'generated-registry' }): Runtime
  export function createPanelAuthRoute(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): { readonly GET: () => object, readonly POST: () => object }
  export function createPanelTenantRoute(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): { readonly GET: () => object, readonly POST: () => object }
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
  type Runtime = { readonly registry: { readonly source: 'generated-registry' }, readonly source: 'generated-runtime' }
  export function createGeneratedNuxtPanelsRuntime(registry: { readonly source: 'generated-registry' }): Runtime
  export function createPanelOperationHandler(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): object
  export function createPanelAuthHandler(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): object
  export function createPanelTenantHandler(options: { readonly panelIds: readonly string[], readonly runtime: Runtime }): object
}
declare module '@holo-js/panels-nuxt' {
}
declare module '@holo-js/panels-sveltekit/server' {
  type Registry = { readonly registry: { readonly source: 'generated-registry' }, readonly source: 'generated-registry-runtime' }
  export function createGeneratedSvelteKitPanelsRegistry(registry: { readonly source: 'generated-registry' }): Registry
  export function createPanelPageLoad(options: { readonly panelId: string, readonly registry: Registry }): () => object
  export function createPanelOperationHandler(options: { readonly panelIds: readonly string[], readonly registry: Registry }): { readonly GET: () => object, readonly POST: () => object }
  export function createPanelAuthHandler(options: { readonly panelIds: readonly string[], readonly registry: Registry }): { readonly GET: () => object, readonly POST: () => object }
  export function createPanelTenantHandler(options: { readonly panelIds: readonly string[], readonly registry: Registry }): { readonly GET: () => object, readonly POST: () => object }
}
declare module '@holo-js/panels-sveltekit' {
  type Registry = { readonly registry: { readonly source: 'generated-registry' }, readonly source: 'generated-registry-runtime' }
  export function createGeneratedSvelteKitPanelsRegistry(registry: { readonly source: 'generated-registry' }): Registry
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
      expect(nextOptions).toEqual({ panelIds: ['staff', 'admin'], runtime: { registry: { source: 'generated-registry' }, source: 'generated-runtime' } })
      const nextPagePath = join(root, plans.next.writes.find(write => write.kind === 'panel-page')!.path)
      const nextPage = await executeModule(nextPagePath)
      expect((nextPage.default as () => object)()).toMatchObject({ runtime: { registry: { source: 'generated-registry' }, source: 'generated-runtime' } })

      const nuxtEndpointPath = join(root, plans.nuxt.writes.find(write => write.kind === 'operation-endpoint')!.path)
      const nuxtEndpoint = await executeModule(nuxtEndpointPath)
      expect(nuxtEndpoint.default).toEqual({ panelIds: ['staff', 'admin'], runtime: { registry: { source: 'generated-registry' }, source: 'generated-runtime' } })

      const svelteEndpointPath = join(root, plans.sveltekit.writes.find(write => write.kind === 'operation-endpoint')!.path)
      const svelteEndpoint = await executeModule(svelteEndpointPath)
      expect((svelteEndpoint.POST as () => object)()).toEqual({ panelIds: ['staff', 'admin'], registry: { registry: { source: 'generated-registry' }, source: 'generated-registry-runtime' } })
      const sveltePagePath = join(root, plans.sveltekit.writes.find(write => write.path.endsWith('+page.server.ts'))!.path)
      const sveltePage = await executeModule(sveltePagePath)
      expect((sveltePage.load as () => object)()).toMatchObject({ registry: { registry: { source: 'generated-registry' }, source: 'generated-registry-runtime' } })

      expect(plans.nuxt.writes.find(write => write.path.endsWith('.vue'))?.contents).toContain("panelId: 'staff'")
      expect(plans.nuxt.writes.find(write => write.path.endsWith('.vue'))?.contents).toContain("useRequestFetch()('/holo/panels/staff/auth/mfa-status')")
      expect(plans.nuxt.writes.find(write => write.path.endsWith('.vue'))?.contents).toContain('redirectCode: 302')
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
      'app/admin/[[...panelsPath]]/page.tsx',
      'app/admin/[[...panelsPath]]/panels-client.tsx',
      'app/holo/panels/[panelId]/[operation]/route.ts',
      'app/holo/panels/[panelId]/auth/[operation]/route.ts',
      'app/holo/panels/[panelId]/tenant/[operation]/route.ts',
      'app/staff/[[...panelsPath]]/page.tsx',
      'app/staff/[[...panelsPath]]/panels-client.tsx',
    ])
    expect(plan.writes[2]?.panelIds).toEqual(['admin', 'staff'])
  })

  it('places Nuxt artifacts in the directories resolved from Nuxt configuration', () => {
    const plan = planFrameworkArtifacts({
      directories: { pages: 'frontend/screens', server: 'backend' },
      framework: 'nuxt',
      panels: [{ id: 'admin', path: '/admin' }],
    })

    expect(plan.writes.map(write => write.path)).toEqual([
      'backend/routes/holo/panels/[panelId]/[operation].ts',
      'backend/routes/holo/panels/[panelId]/auth/[operation].ts',
      'backend/routes/holo/panels/[panelId]/tenant/[operation].ts',
      'frontend/screens/admin/[[...panelsPath]].vue',
    ])
  })

  it.each([
    ['next', { pages: 'src/app', server: 'src/app' }, [
      'src/app/admin/[[...panelsPath]]/page.tsx',
      'src/app/admin/[[...panelsPath]]/panels-client.tsx',
      'src/app/admin/forgot-password/page.tsx',
      'src/app/admin/login/page.tsx',
      'src/app/admin/register/page.tsx',
      'src/app/holo/panels/[panelId]/[operation]/route.ts',
      'src/app/holo/panels/[panelId]/auth/[operation]/route.ts',
      'src/app/holo/panels/[panelId]/tenant/[operation]/route.ts',
    ]],
    ['sveltekit', { pages: 'frontend/screens', server: 'frontend/screens' }, [
      'frontend/screens/admin/[...path]/+page.server.ts',
      'frontend/screens/admin/[...path]/+page.svelte',
      'frontend/screens/admin/forgot-password/+page.svelte',
      'frontend/screens/admin/login/+page.svelte',
      'frontend/screens/admin/register/+page.svelte',
      'frontend/screens/holo/panels/[panelId]/[operation]/+server.ts',
      'frontend/screens/holo/panels/[panelId]/auth/[operation]/+server.ts',
      'frontend/screens/holo/panels/[panelId]/tenant/[operation]/+server.ts',
    ]],
  ] as const)('places %s routes and managed login in configured directories', (framework, directories, paths) => {
    const plan = planFrameworkArtifacts({
      directories,
      framework,
      panels: [{ brandingName: 'Control Center', darkMode: 'system', forgotPasswordPath: '/admin/forgot-password', id: 'admin', loginPath: '/admin/login', path: '/admin', registrationPath: '/admin/register', simplePageMaxContentWidth: 'screen-sm', themeColors: { primary: '#7c3aed' } }],
    })

    expect(plan.writes.map(write => write.path)).toEqual(paths)
    const login = plan.writes.find(write => write.kind === 'auth-page' && write.contents.includes('PanelLoginPage'))
    expect(login?.contents).toContain('PanelLoginPage')
    expect(login?.contents).not.toContain('fetch(')
    expect(login?.contents).toContain('panelId="admin"')
    expect(login?.contents).not.toContain('Control Center')
    expect(login?.contents).not.toContain('/admin/forgot-password')
    expect(login?.contents).not.toContain('/admin/register')
    expect(login?.contents).not.toContain('#7c3aed')
    expect(login?.contents).not.toContain('screen-sm')
  })

  it('imports the generated isolated theme in every Nuxt panel and authentication page', () => {
    const plan = planFrameworkArtifacts({
      framework: 'nuxt',
      panels: [{ id: 'admin', loginPath: '/admin/login', mfaChallengePath: '/admin/mfa', path: '/admin', profilePath: '/admin/profile' }],
    })
    const pages = plan.writes.filter(write => write.path.endsWith('.vue'))

    expect(pages).toHaveLength(4)
    expect(pages.every(page => page.contents.includes('.holo-js/generated/panels/theme.css'))).toBe(true)
    expect(pages.every(page => !page.contents.includes('@holo-js/panels-vue/style.css'))).toBe(true)
  })

  it.each(['next', 'nuxt', 'sveltekit'] as const)('keeps generated %s routes free of duplicated panel configuration', (framework) => {
    const plan = planFrameworkArtifacts({
      framework,
      panels: [{
        appearance: {
          colors: { primary: '#123456' },
          density: 'compact',
          fontFamily: 'Panel Sans',
          monoFontFamily: 'Panel Mono',
          serifFontFamily: 'Panel Serif',
          tokens: { 'radius-lg': '1.25rem' },
        },
        emailChangeVerificationPath: '/account/email-change/verify',
        emailVerificationPath: '/account/email/notice',
        emailVerificationVerifyPath: '/account/email/verify',
        forgotPasswordPath: '/account/password/forgot',
        id: 'admin',
        loginPath: '/account/sign-in',
        mfaChallengePath: '/account/mfa/challenge',
        mfaEnrollmentPath: '/account/mfa/manage',
        mfaRecoveryCodesPath: '/account/mfa/recovery',
        passwordResetPath: '/account/password/reset',
        path: '/admin',
        profilePath: '/account/profile',
        registrationPath: '/account/register',
      }],
    })
    const pages = plan.writes.filter(write => write.kind === 'auth-page' || write.kind === 'panel-page')
    const authPages = pages.filter(page => page.kind === 'auth-page')
    const configuredPaths = [
      '/account/email-change/verify',
      '/account/email/notice',
      '/account/email/verify',
      '/account/mfa/challenge',
      '/account/mfa/manage',
      '/account/mfa/recovery',
      '/account/password/forgot',
      '/account/password/reset',
      '/account/profile',
      '/account/register',
      '/account/sign-in',
    ]

    expect(authPages).toHaveLength(configuredPaths.length)
    expect(authPages.every(page => page.contents.includes(framework === 'nuxt' ? 'panel-id' : 'panelId'))).toBe(true)
    for (const page of pages) {
      for (const configuredPath of configuredPaths) expect(page.contents).not.toContain(configuredPath)
      expect(page.contents).not.toContain('appearance')
      expect(page.contents).not.toContain('#123456')
      expect(page.contents).not.toContain('compact')
      expect(page.contents).not.toContain('Panel Sans')
      expect(page.contents).not.toContain('Panel Mono')
      expect(page.contents).not.toContain('Panel Serif')
      expect(page.contents).not.toContain('radius-lg')
    }
    if (framework === 'nuxt') {
      expect(pages.find(page => page.kind === 'panel-page')?.contents).toContain('/auth/presentation')
    }
  })

  it.each([
    ['next', { pages: 'src/app', server: 'src/app' }, ['src/app/cp/join/page.tsx', 'src/app/cp/password/request/page.tsx', 'src/app/cp/password/reset/page.tsx', 'src/app/cp/verify/prompt/page.tsx', 'src/app/cp/verify/confirm/page.tsx', 'src/app/cp/mfa/page.tsx', 'src/app/cp/profile/page.tsx', 'src/app/cp/profile/mfa/page.tsx', 'src/app/cp/profile/mfa/recovery/page.tsx']],
    ['nuxt', { pages: 'app/pages', server: 'server' }, ['app/pages/cp/join.vue', 'app/pages/cp/password/request.vue', 'app/pages/cp/password/reset.vue', 'app/pages/cp/verify/prompt.vue', 'app/pages/cp/verify/confirm.vue', 'app/pages/cp/mfa.vue', 'app/pages/cp/profile/index.vue', 'app/pages/cp/profile/mfa/index.vue', 'app/pages/cp/profile/mfa/recovery.vue']],
    ['sveltekit', { pages: 'src/routes', server: 'src/routes' }, ['src/routes/cp/join/+page.svelte', 'src/routes/cp/password/request/+page.svelte', 'src/routes/cp/password/reset/+page.svelte', 'src/routes/cp/verify/prompt/+page.svelte', 'src/routes/cp/verify/confirm/+page.svelte', 'src/routes/cp/mfa/+page.svelte', 'src/routes/cp/profile/+page.svelte', 'src/routes/cp/profile/mfa/+page.svelte', 'src/routes/cp/profile/mfa/recovery/+page.svelte']],
  ] as const)('generates each enabled %s authentication page independently', (framework, directories, expectedPaths) => {
    const plan = planFrameworkArtifacts({
      directories,
      framework,
      panels: [{
        emailVerificationPath: '/cp/verify/prompt',
        emailVerificationVerifyPath: '/cp/verify/confirm',
        forgotPasswordPath: '/cp/password/request',
        id: 'control',
        mfaChallengePath: '/cp/mfa',
        mfaEnrollmentPath: '/cp/profile/mfa',
        mfaRecoveryCodesPath: '/cp/profile/mfa/recovery',
        passwordResetPath: '/cp/password/reset',
        path: '/cp',
        profilePath: '/cp/profile',
        registrationPath: '/cp/join',
      }],
    })

    expect(expectedPaths.every(path => plan.writes.some(write => write.kind === 'auth-page' && write.path === path))).toBe(true)
    expect(plan.writes.filter(write => write.kind === 'auth-page')).toHaveLength(expectedPaths.length)
  })

  it('rejects duplicate managed login routes', () => {
    expect(() => planFrameworkArtifacts({
      framework: 'next',
      panels: [
        { id: 'admin', loginPath: '/sign-in', path: '/admin' },
        { id: 'staff', loginPath: '/sign-in', path: '/staff' },
      ],
    })).toThrow('Multiple generated routes target app/sign-in/page.tsx')
  })

  it.each(['../pages', '/pages', 'C:\\pages'])('rejects an unsafe Nuxt artifact directory %s', (pages) => {
    expect(() => planFrameworkArtifacts({
      directories: { pages, server: 'server' },
      framework: 'nuxt',
      panels: [{ id: 'admin', path: '/admin' }],
    })).toThrow('Invalid pages directory')
  })

  it.each([
    [[{ id: 'admin', path: '/admin' }, { id: 'staff', path: '/admin/staff' }]],
    [[{ id: 'root', path: '/' }, { id: 'admin', path: '/admin' }]],
    [[{ id: 'admin', path: '/admin/' }, { id: 'staff', path: 'admin' }]],
  ])('rejects cross-panel path overlap', (panels) => {
    expect(() => planFrameworkArtifacts({ framework: 'next', panels })).toThrow('Panel paths overlap')
  })

  it('refuses an unmanaged target and emits the complete manual integration snippet', () => {
    const initial = planFrameworkArtifacts({ directories: nuxtDirectories, framework: 'nuxt', panels: [{ id: 'admin', path: '/admin' }] })
    const target = initial.writes[0]!
    const plan = planFrameworkArtifacts({
      directories: nuxtDirectories,
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

  it('adopts an exact generated managed file when the ownership manifest is missing', () => {
    const initial = planFrameworkArtifacts({ framework: 'next', panels: [{ id: 'admin', path: '/admin' }] })
    const page = initial.writes.find(write => write.kind === 'panel-page')!
    const plan = planFrameworkArtifacts({
      framework: 'next',
      panels: [{ id: 'admin', path: '/admin' }],
      existingArtifacts: initial.writes.map(write => ({ path: write.path, contents: write.contents })),
    })

    expect(plan.writes).toEqual([])
    expect(plan.conflicts).toEqual([])
    expect(plan.unchanged).toContainEqual(expect.objectContaining({ path: page.path, checksum: page.checksum }))
    expect(plan.ownership.artifacts).toContainEqual(expect.objectContaining({ path: page.path, checksum: page.checksum }))
  })

  it('updates a self-authenticating generated file when the ownership manifest is missing', () => {
    const initial = planFrameworkArtifacts({ framework: 'next', panels: [{ id: 'admin', path: '/admin' }] })
    const endpoint = initial.writes.find(write => write.kind === 'operation-endpoint')!
    const updated = planFrameworkArtifacts({
      existingArtifacts: [{ path: endpoint.path, contents: endpoint.contents }],
      framework: 'next',
      panels: [{ id: 'admin', path: '/admin' }, { id: 'staff', path: '/staff' }],
    })

    expect(updated.conflicts).toEqual([])
    expect(updated.writes).toContainEqual(expect.objectContaining({ path: endpoint.path, panelIds: ['admin', 'staff'], status: 'update' }))
    expect(updated.ownership.artifacts).toContainEqual(expect.objectContaining({ path: endpoint.path, panelIds: ['admin', 'staff'] }))
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
      panels: [{ id: 'internal', path: '/holo/panels' }],
    })).toThrow('reserved /holo path')
  })
})
