import { posix } from 'node:path'
import type { DiscoveredPanelAppearance, DiscoveredPanelPath, FrameworkArtifactDirectories, FrameworkArtifactKind, FrameworkId } from './contracts'

export const MANAGED_ARTIFACT_MARKER = '@holo-panels-managed sha256:'

type ArtifactTemplate = {
  readonly path: string
  readonly kind: FrameworkArtifactKind
  readonly panelIds: readonly string[]
  readonly body: string
}

function routePath(panelPath: string): string {
  return panelPath === '/' ? '' : panelPath.slice(1)
}

function nuxtPagePath(panelPath: string, directories: FrameworkArtifactDirectories, managedPaths: readonly string[]): string {
  const path = routePath(panelPath)
  const hasDescendant = managedPaths.some(candidate => candidate !== panelPath && candidate.startsWith(`${panelPath}/`))
  return hasDescendant ? posix.join(directories.pages, path, 'index.vue') : posix.join(directories.pages, `${path}.vue`)
}

function moduleSpecifier(artifactPath: string, modulePath: string): string {
  const relative = posix.relative(posix.dirname(artifactPath), modulePath.replace(/\.ts$/u, ''))
  return relative.startsWith('.') ? relative : `./${relative}`
}

function resolvedAppearance(appearance: DiscoveredPanelAppearance | undefined, themeColors: Readonly<Record<string, string>>): DiscoveredPanelAppearance | undefined {
  if (!appearance) return undefined
  const colors = { ...themeColors, ...appearance.colors }
  return {
    ...appearance,
    ...(Object.keys(colors).length > 0 ? { colors } : {}),
  }
}

function jsxAppearanceProp(appearance: DiscoveredPanelAppearance | undefined, themeColors: Readonly<Record<string, string>>): string {
  const resolved = resolvedAppearance(appearance, themeColors)
  return resolved
    ? ` appearance={${JSON.stringify(resolved)}}`
    : ` themeColors={${JSON.stringify(themeColors)}}`
}

function nuxtAppearanceBindings(appearance: DiscoveredPanelAppearance | undefined, themeColors: Readonly<Record<string, string>>): readonly [string, string] {
  const resolved = resolvedAppearance(appearance, themeColors)
  return resolved
    ? [`const appearance = ${JSON.stringify(resolved)} as const`, ':appearance="appearance"']
    : [`const themeColors = ${JSON.stringify(themeColors)}`, ':theme-colors="themeColors"']
}

function svelteAppearanceProp(appearance: DiscoveredPanelAppearance | undefined, themeColors: Readonly<Record<string, string>>): string {
  const resolved = resolvedAppearance(appearance, themeColors)
  return resolved
    ? ` appearance={${JSON.stringify(resolved)}}`
    : ` themeColors={${JSON.stringify(themeColors)}}`
}

function nextTemplates(panelId: string, panelPath: string, directories: FrameworkArtifactDirectories, loginPath?: string, brandingName = 'Holo Panels', darkMode = 'light', forgotPasswordPath?: string, registrationPath?: string, themeColors: Readonly<Record<string, string>> = {}, simplePageMaxContentWidth = 'lg', appearance?: DiscoveredPanelAppearance): readonly ArtifactTemplate[] {
  const basePath = routePath(panelPath)
  const pagePath = posix.join(directories.pages, basePath, '[[...panelsPath]]/page.tsx')
  const clientPath = posix.join(directories.pages, basePath, '[[...panelsPath]]/panels-client.tsx')
  const serverRegistryImport = moduleSpecifier(pagePath, '.holo-js/generated/panels/server-registry.ts')
  const rendererImport = moduleSpecifier(clientPath, '.holo-js/generated/panels/plugin-renderers.ts')
  return [
    {
      path: pagePath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `import { createGeneratedNextPanelsRuntime, createPanelPage } from '@holo-js/panels-next'\nimport serverRegistry from '${serverRegistryImport}'\nimport { PanelsClient } from './panels-client'\n\nconst runtime = createGeneratedNextPanelsRuntime(serverRegistry)\n\nexport default createPanelPage({ client: PanelsClient, loginPath: '${loginPath ?? '/login'}', panelId: '${panelId}', runtime })\n`,
    },
    {
      path: clientPath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `'use client'\n\nimport '@holo-js/panels-react/style.css'\nimport { createNextPanelComponentRegistry, NextPanelClient, type NextPanelClientProps } from '@holo-js/panels-next/client'\nimport { registerPanelPluginRenderers } from '${rendererImport}'\n\nconst registry = registerPanelPluginRenderers(createNextPanelComponentRegistry())\n\nexport function PanelsClient(props: Pick<NextPanelClientProps, 'payload'>) {\n  return <NextPanelClient {...props} registry={registry} />\n}\n`,
    },
    ...(loginPath ? [nextLoginTemplate(panelId, loginPath, directories, brandingName, darkMode, forgotPasswordPath, registrationPath, themeColors, simplePageMaxContentWidth, appearance)] : []),
  ]
}

function nextLoginTemplate(panelId: string, loginPath: string, directories: FrameworkArtifactDirectories, brandingName: string, darkMode: string, forgotPasswordPath: string | undefined, registrationPath: string | undefined, themeColors: Readonly<Record<string, string>>, simplePageMaxContentWidth: string, appearance?: DiscoveredPanelAppearance): ArtifactTemplate {
  return {
    path: posix.join(directories.pages, routePath(loginPath), 'page.tsx'),
    kind: 'auth-page',
    panelIds: [panelId],
    body: `'use client'\n\nimport '@holo-js/panels-react/style.css'\nimport { NextPanelLoginPage } from '@holo-js/panels-next/client'\n\nexport default function LoginPage() {\n  return <NextPanelLoginPage brandName={${JSON.stringify(brandingName)}}${forgotPasswordPath ? ` forgotPasswordPath="${forgotPasswordPath}"` : ''} panelId="${panelId}"${registrationPath ? ` registrationPath="${registrationPath}"` : ''} simplePageMaxContentWidth="${simplePageMaxContentWidth}" theme="${darkMode}"${jsxAppearanceProp(appearance, themeColors)} />\n}\n`,
  }
}

function nuxtTemplates(panelId: string, panelPath: string, directories: FrameworkArtifactDirectories, managedPaths: readonly string[], loginPath?: string, brandingName = 'Holo Panels', darkMode = 'light', forgotPasswordPath?: string, registrationPath?: string, themeColors: Readonly<Record<string, string>> = {}, simplePageMaxContentWidth = 'lg', appearance?: DiscoveredPanelAppearance): readonly ArtifactTemplate[] {
  const basePath = routePath(panelPath)
  const pagePath = posix.join(directories.pages, basePath, '[[...panelsPath]].vue')
  const rendererImport = moduleSpecifier(pagePath, '.holo-js/generated/panels/plugin-renderers.ts')
  return [
    {
      path: pagePath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `<script setup lang="ts">\nimport '@holo-js/panels-vue/style.css'\nimport { createNuxtPanelComponentRegistry, PanelPage, usePanelPage } from '@holo-js/panels-nuxt'\nimport { registerPanelPluginRenderers } from '${rendererImport}'\n\ndefinePageMeta({\n  middleware: async (to) => {\n    try {\n      await useRequestFetch()('/holo/panels/${panelId}/auth/mfa-status')\n    } catch {\n      return navigateTo(\`${loginPath ?? '/login'}?next=\${encodeURIComponent(to.fullPath)}\`, { redirectCode: 302 })\n    }\n  },\n})\n\nconst panelPage = await usePanelPage({ panelId: '${panelId}' })\nconst registry = registerPanelPluginRenderers(createNuxtPanelComponentRegistry())\n</script>\n\n<template>\n  <PanelPage :page="panelPage" :registry="registry" />\n</template>\n`,
    },
    ...(loginPath ? [nuxtLoginTemplate(panelId, loginPath, directories, managedPaths, brandingName, darkMode, forgotPasswordPath, registrationPath, themeColors, simplePageMaxContentWidth, appearance)] : []),
  ]
}

function nuxtLoginTemplate(panelId: string, loginPath: string, directories: FrameworkArtifactDirectories, managedPaths: readonly string[], brandingName: string, darkMode: string, forgotPasswordPath: string | undefined, registrationPath: string | undefined, themeColors: Readonly<Record<string, string>>, simplePageMaxContentWidth: string, appearance?: DiscoveredPanelAppearance): ArtifactTemplate {
  const [appearanceDeclaration, appearanceBinding] = nuxtAppearanceBindings(appearance, themeColors)
  return {
    path: nuxtPagePath(loginPath, directories, managedPaths),
    kind: 'auth-page',
    panelIds: [panelId],
    body: `<script setup lang="ts">\nimport '@holo-js/panels-vue/style.css'\nimport { PanelLoginPage } from '@holo-js/panels-nuxt'\n\nconst brandName = ${JSON.stringify(brandingName)}\n${appearanceDeclaration}\n</script>\n\n<template>\n  <PanelLoginPage ${appearanceBinding} :brand-name="brandName"${forgotPasswordPath ? ` forgot-password-path="${forgotPasswordPath}"` : ''} panel-id="${panelId}"${registrationPath ? ` registration-path="${registrationPath}"` : ''} simple-page-max-content-width="${simplePageMaxContentWidth}" theme="${darkMode}" />\n</template>\n`,
  }
}

function svelteKitTemplates(panelId: string, panelPath: string, directories: FrameworkArtifactDirectories, loginPath?: string, brandingName = 'Holo Panels', darkMode = 'light', forgotPasswordPath?: string, registrationPath?: string, themeColors: Readonly<Record<string, string>> = {}, simplePageMaxContentWidth = 'lg', appearance?: DiscoveredPanelAppearance): readonly ArtifactTemplate[] {
  const basePath = routePath(panelPath)
  const routeRoot = posix.join(directories.pages, basePath, '[...path]')
  const pageServerPath = `${routeRoot}/+page.server.ts`
  const registryImport = moduleSpecifier(pageServerPath, '.holo-js/generated/panels/server-registry.ts')
  const pagePath = `${routeRoot}/+page.svelte`
  const rendererImport = moduleSpecifier(pagePath, '.holo-js/generated/panels/plugin-renderers.ts')
  return [
    {
      path: pageServerPath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `import { createGeneratedSvelteKitPanelsRegistry, createPanelPageLoad } from '@holo-js/panels-sveltekit/server'\nimport serverRegistry from '${registryImport}'\n\nconst registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)\n\nexport const load = createPanelPageLoad({ loginPath: '${loginPath ?? '/login'}', panelId: '${panelId}', registry })\n`,
    },
    {
      path: pagePath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `<script lang="ts">\n  import '@holo-js/panels-svelte/style.css'\n  import { createSvelteKitPanelComponentRegistry, PanelPage } from '@holo-js/panels-sveltekit'\n  import { registerPanelPluginRenderers } from '${rendererImport}'\n\n  let { data } = $props()\n  const registry = registerPanelPluginRenderers(createSvelteKitPanelComponentRegistry())\n</script>\n\n<PanelPage {data} {registry} />\n`,
    },
    ...(loginPath ? [svelteKitLoginTemplate(panelId, loginPath, directories, brandingName, darkMode, forgotPasswordPath, registrationPath, themeColors, simplePageMaxContentWidth, appearance)] : []),
  ]
}

function svelteKitLoginTemplate(panelId: string, loginPath: string, directories: FrameworkArtifactDirectories, brandingName: string, darkMode: string, forgotPasswordPath: string | undefined, registrationPath: string | undefined, themeColors: Readonly<Record<string, string>>, simplePageMaxContentWidth: string, appearance?: DiscoveredPanelAppearance): ArtifactTemplate {
  return {
    path: posix.join(directories.pages, routePath(loginPath), '+page.svelte'),
    kind: 'auth-page',
    panelIds: [panelId],
    body: `<script lang="ts">\n  import '@holo-js/panels-svelte/style.css'\n  import { PanelLoginPage } from '@holo-js/panels-sveltekit'\n</script>\n\n<PanelLoginPage brandName={${JSON.stringify(brandingName)}}${forgotPasswordPath ? ` forgotPasswordPath="${forgotPasswordPath}"` : ''} panelId="${panelId}"${registrationPath ? ` registrationPath="${registrationPath}"` : ''} simplePageMaxContentWidth="${simplePageMaxContentWidth}" theme="${darkMode}"${svelteAppearanceProp(appearance, themeColors)} />\n`,
  }
}

type GeneratedAuthPage = Readonly<{ path: string, type: 'email-verification' | 'email-verification-verify' | 'mfa-challenge' | 'mfa-management' | 'password-reset-request' | 'password-reset' | 'profile' | 'registration' }>

function generatedAuthPages(panel: DiscoveredPanelPath): readonly GeneratedAuthPage[] {
  return [
    ...(panel.emailChangeVerificationPath ? [{ path: panel.emailChangeVerificationPath, type: 'email-verification-verify' as const }] : []),
    ...(panel.registrationPath ? [{ path: panel.registrationPath, type: 'registration' as const }] : []),
    ...(panel.forgotPasswordPath ? [{ path: panel.forgotPasswordPath, type: 'password-reset-request' as const }] : []),
    ...(panel.passwordResetPath ? [{ path: panel.passwordResetPath, type: 'password-reset' as const }] : []),
    ...(panel.profilePath ? [{ path: panel.profilePath, type: 'profile' as const }] : []),
    ...(panel.emailVerificationPath ? [{ path: panel.emailVerificationPath, type: 'email-verification' as const }] : []),
    ...(panel.emailVerificationVerifyPath ? [{ path: panel.emailVerificationVerifyPath, type: 'email-verification-verify' as const }] : []),
    ...(panel.mfaChallengePath ? [{ path: panel.mfaChallengePath, type: 'mfa-challenge' as const }] : []),
    ...(panel.mfaEnrollmentPath ? [{ path: panel.mfaEnrollmentPath, type: 'mfa-management' as const }] : []),
    ...(panel.mfaRecoveryCodesPath && panel.mfaRecoveryCodesPath !== panel.mfaEnrollmentPath ? [{ path: panel.mfaRecoveryCodesPath, type: 'mfa-management' as const }] : []),
  ]
}

function additionalAuthPageTemplates(framework: FrameworkId, panel: DiscoveredPanelPath, directories: FrameworkArtifactDirectories): readonly ArtifactTemplate[] {
  const brandName = panel.brandingName ?? 'Holo Panels'
  const theme = panel.darkMode ?? 'light'
  const themeColors = panel.themeColors ?? {}
  const appearance = panel.appearance
  const width = panel.simplePageMaxContentWidth ?? 'lg'
  const authPages = generatedAuthPages(panel)
  const managedPaths = [...(panel.loginPath ? [panel.loginPath] : []), ...authPages.map(page => page.path)]
  return authPages.map((authPage): ArtifactTemplate => {
    const component = authPage.type === 'mfa-management' ? 'MultiFactor' : authPage.type === 'profile' ? 'Profile' : 'Auth'
    const auth = component === 'Auth'
    const [appearanceDeclaration, appearanceBinding] = nuxtAppearanceBindings(appearance, themeColors)
    if (framework === 'next') {
      return {
        body: `'use client'\n\nimport '@holo-js/panels-react/style.css'\nimport { NextPanel${component}Page } from '@holo-js/panels-next/client'\n\nexport default function AuthPage() {\n  return <NextPanel${component}Page brandName={${JSON.stringify(brandName)}}${auth && panel.loginPath ? ` loginPath="${panel.loginPath}"` : ''} panelId="${panel.id}" simplePageMaxContentWidth="${width}" theme="${theme}"${jsxAppearanceProp(appearance, themeColors)}${auth ? ` type="${authPage.type}"` : ''} />\n}\n`,
        kind: 'auth-page',
        panelIds: [panel.id],
        path: posix.join(directories.pages, routePath(authPage.path), 'page.tsx'),
      }
    }
    if (framework === 'nuxt') {
      return {
        body: `<script setup lang="ts">\nimport '@holo-js/panels-vue/style.css'\nimport { Panel${component}Page } from '@holo-js/panels-nuxt'\n\nconst brandName = ${JSON.stringify(brandName)}\n${appearanceDeclaration}\n</script>\n\n<template>\n  <Panel${component}Page ${appearanceBinding} :brand-name="brandName"${auth && panel.loginPath ? ` login-path="${panel.loginPath}"` : ''} panel-id="${panel.id}" simple-page-max-content-width="${width}" theme="${theme}"${auth ? ` type="${authPage.type}"` : ''} />\n</template>\n`,
        kind: 'auth-page',
        panelIds: [panel.id],
        path: nuxtPagePath(authPage.path, directories, managedPaths),
      }
    }
    return {
      body: `<script lang="ts">\n  import '@holo-js/panels-svelte/style.css'\n  import { Panel${component}Page } from '@holo-js/panels-sveltekit'\n</script>\n\n<Panel${component}Page brandName={${JSON.stringify(brandName)}}${auth && panel.loginPath ? ` loginPath="${panel.loginPath}"` : ''} panelId="${panel.id}" simplePageMaxContentWidth="${width}" theme="${theme}"${svelteAppearanceProp(appearance, themeColors)}${auth ? ` type="${authPage.type}"` : ''} />\n`,
      kind: 'auth-page',
      panelIds: [panel.id],
      path: posix.join(directories.pages, routePath(authPage.path), '+page.svelte'),
    }
  })
}

function operationTemplates(framework: FrameworkId, panelIds: readonly string[], directories?: FrameworkArtifactDirectories): readonly ArtifactTemplate[] {
  const serializedPanelIds = `[${panelIds.map(panelId => `'${panelId}'`).join(', ')}]`
  if (framework === 'next') {
    if (!directories) throw new Error('Next framework artifact directories are required')
    const path = posix.join(directories.server, 'holo/panels/[panelId]/[operation]/route.ts')
    const serverRegistryImport = moduleSpecifier(path, '.holo-js/generated/panels/server-registry.ts')
    const operation: ArtifactTemplate = {
      path,
      kind: 'operation-endpoint',
      panelIds,
      body: `import { createGeneratedNextPanelsRuntime, createPanelOperationRoute } from '@holo-js/panels-next'\nimport serverRegistry from '${serverRegistryImport}'\n\nconst runtime = createGeneratedNextPanelsRuntime(serverRegistry)\nconst route = createPanelOperationRoute({ panelIds: ${serializedPanelIds}, runtime })\n\nexport const DELETE = route.DELETE\nexport const GET = route.GET\nexport const PATCH = route.PATCH\nexport const POST = route.POST\nexport const PUT = route.PUT\n`,
    }
    return [
      operation,
      ...(['auth', 'tenant'] as const).map((scope): ArtifactTemplate => {
        const scopedPath = posix.join(directories.server, `holo/panels/[panelId]/${scope}/[operation]/route.ts`)
        const registryImport = moduleSpecifier(scopedPath, '.holo-js/generated/panels/server-registry.ts')
        const factory = scope === 'auth' ? 'createPanelAuthRoute' : 'createPanelTenantRoute'
        return {
          path: scopedPath,
          kind: 'operation-endpoint',
          panelIds,
          body: `import { createGeneratedNextPanelsRuntime, ${factory} } from '@holo-js/panels-next/server'\nimport serverRegistry from '${registryImport}'\n\nconst runtime = createGeneratedNextPanelsRuntime(serverRegistry)\nconst route = ${factory}({ panelIds: ${serializedPanelIds}, runtime })\n\nexport const GET = route.GET\nexport const POST = route.POST\n`,
        }
      }),
    ]
  }
  if (framework === 'nuxt') {
    if (!directories) throw new Error('Nuxt framework artifact directories are required')
    const path = posix.join(directories.server, 'routes/holo/panels/[panelId]/[operation].ts')
    const registryImport = moduleSpecifier(path, '.holo-js/generated/panels/server-registry.ts')
    const operation: ArtifactTemplate = {
      path,
      kind: 'operation-endpoint',
      panelIds,
      body: `import { createGeneratedNuxtPanelsRuntime, createPanelOperationHandler } from '@holo-js/panels-nuxt/server'\nimport serverRegistry from '${registryImport}'\n\nconst runtime = createGeneratedNuxtPanelsRuntime(serverRegistry)\n\nexport default createPanelOperationHandler({ panelIds: ${serializedPanelIds}, runtime })\n`,
    }
    return [
      operation,
      ...(['auth', 'tenant'] as const).map((scope): ArtifactTemplate => {
        const scopedPath = posix.join(directories.server, `routes/holo/panels/[panelId]/${scope}/[operation].ts`)
        const scopedRegistryImport = moduleSpecifier(scopedPath, '.holo-js/generated/panels/server-registry.ts')
        const factory = scope === 'auth' ? 'createPanelAuthHandler' : 'createPanelTenantHandler'
        return {
          path: scopedPath,
          kind: 'operation-endpoint',
          panelIds,
          body: `import { createGeneratedNuxtPanelsRuntime, ${factory} } from '@holo-js/panels-nuxt/server'\nimport serverRegistry from '${scopedRegistryImport}'\n\nconst runtime = createGeneratedNuxtPanelsRuntime(serverRegistry)\n\nexport default ${factory}({ panelIds: ${serializedPanelIds}, runtime })\n`,
        }
      }),
    ]
  }
  if (!directories) throw new Error('SvelteKit framework artifact directories are required')
  const path = posix.join(directories.server, 'holo/panels/[panelId]/[operation]/+server.ts')
  const registryImport = moduleSpecifier(path, '.holo-js/generated/panels/server-registry.ts')
  const operation: ArtifactTemplate = {
    path,
    kind: 'operation-endpoint',
    panelIds,
    body: `import { createGeneratedSvelteKitPanelsRegistry, createPanelOperationHandler } from '@holo-js/panels-sveltekit/server'\nimport serverRegistry from '${registryImport}'\n\nconst registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)\nconst handler = createPanelOperationHandler({ panelIds: ${serializedPanelIds}, registry })\n\nexport const GET = handler.GET\nexport const POST = handler.POST\n`,
  }
  return [
    operation,
    ...(['auth', 'tenant'] as const).map((scope): ArtifactTemplate => {
      const scopedPath = posix.join(directories.server, `holo/panels/[panelId]/${scope}/[operation]/+server.ts`)
      const scopedRegistryImport = moduleSpecifier(scopedPath, '.holo-js/generated/panels/server-registry.ts')
      const factory = scope === 'auth' ? 'createPanelAuthHandler' : 'createPanelTenantHandler'
      return {
        path: scopedPath,
        kind: 'operation-endpoint',
        panelIds,
        body: `import { createGeneratedSvelteKitPanelsRegistry, ${factory} } from '@holo-js/panels-sveltekit/server'\nimport serverRegistry from '${scopedRegistryImport}'\n\nconst registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)\nconst handler = ${factory}({ panelIds: ${serializedPanelIds}, registry })\n\nexport const GET = handler.GET\nexport const POST = handler.POST\n`,
      }
    }),
  ]
}

function routeFilesystemPath(source: string): string {
  return source.split('/').filter(Boolean).map(segment => segment.startsWith(':') ? `[${segment.slice(1)}]` : segment).join('/')
}

function customRouteTemplates(framework: FrameworkId, panels: readonly DiscoveredPanelPath[], directories: FrameworkArtifactDirectories): readonly ArtifactTemplate[] {
  if (framework === 'next') return []
  return panels.flatMap(panel => [...new Set((panel.routes ?? []).map(route => route.source))].map((source): ArtifactTemplate => {
    const routePath = routeFilesystemPath(source)
    if (framework === 'nuxt') {
      const path = posix.join(directories.server, 'routes', `${routePath}.ts`)
      const registryImport = moduleSpecifier(path, '.holo-js/generated/panels/server-registry.ts')
      return {
        body: `import { createGeneratedNuxtPanelRouteHandler, createGeneratedNuxtPanelsRuntime } from '@holo-js/panels-nuxt/server'\nimport serverRegistry from '${registryImport}'\n\nconst runtime = createGeneratedNuxtPanelsRuntime(serverRegistry)\n\nexport default createGeneratedNuxtPanelRouteHandler({ panelId: '${panel.id}', runtime })\n`,
        kind: 'operation-endpoint',
        panelIds: [panel.id],
        path,
      }
    }
    const path = posix.join(directories.server, routePath, '+server.ts')
    const registryImport = moduleSpecifier(path, '.holo-js/generated/panels/server-registry.ts')
    return {
      body: `import { createGeneratedSvelteKitPanelRoute, createGeneratedSvelteKitPanelsRegistry } from '@holo-js/panels-sveltekit/server'\nimport serverRegistry from '${registryImport}'\n\nconst registry = createGeneratedSvelteKitPanelsRegistry(serverRegistry)\nconst route = createGeneratedSvelteKitPanelRoute({ panelId: '${panel.id}', registry })\n\nexport const DELETE = route.DELETE\nexport const GET = route.GET\nexport const PATCH = route.PATCH\nexport const POST = route.POST\nexport const PUT = route.PUT\n`,
      kind: 'operation-endpoint',
      panelIds: [panel.id],
      path,
    }
  }))
}

export function frameworkArtifactTemplates(
  framework: FrameworkId,
  panels: readonly DiscoveredPanelPath[],
  directories?: FrameworkArtifactDirectories,
): readonly ArtifactTemplate[] {
  const resolvedDirectories = directories ?? (framework === 'next'
    ? { pages: 'app', server: 'app' }
    : framework === 'nuxt'
      ? { pages: 'pages', server: 'server' }
      : { pages: 'src/routes', server: 'src/routes' })
  const pages = panels.flatMap((panel) => {
    if (framework === 'next') {
      return nextTemplates(panel.id, panel.path, resolvedDirectories, panel.loginPath, panel.brandingName, panel.darkMode, panel.forgotPasswordPath, panel.registrationPath, panel.themeColors, panel.simplePageMaxContentWidth, panel.appearance)
    }
    if (framework === 'nuxt') {
      const managedPaths = [...(panel.loginPath ? [panel.loginPath] : []), ...generatedAuthPages(panel).map(page => page.path)]
      return nuxtTemplates(panel.id, panel.path, resolvedDirectories, managedPaths, panel.loginPath, panel.brandingName, panel.darkMode, panel.forgotPasswordPath, panel.registrationPath, panel.themeColors, panel.simplePageMaxContentWidth, panel.appearance)
    }
    return svelteKitTemplates(panel.id, panel.path, resolvedDirectories, panel.loginPath, panel.brandingName, panel.darkMode, panel.forgotPasswordPath, panel.registrationPath, panel.themeColors, panel.simplePageMaxContentWidth, panel.appearance)
  })
  const authPages = panels.flatMap(panel => additionalAuthPageTemplates(framework, panel, resolvedDirectories))
  return [...pages, ...authPages, ...operationTemplates(framework, panels.map(panel => panel.id), resolvedDirectories), ...customRouteTemplates(framework, panels, resolvedDirectories)]
}
