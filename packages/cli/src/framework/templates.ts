import { posix } from 'node:path'
import type { FrameworkArtifactKind, FrameworkId } from './contracts'

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

function moduleSpecifier(artifactPath: string, modulePath: string): string {
  const relative = posix.relative(posix.dirname(artifactPath), modulePath.replace(/\.ts$/u, ''))
  return relative.startsWith('.') ? relative : `./${relative}`
}

function nextTemplates(panelId: string, panelPath: string): readonly ArtifactTemplate[] {
  const basePath = routePath(panelPath)
  const pagePath = basePath ? `app/${basePath}/[[...panelsPath]]/page.tsx` : 'app/[[...panelsPath]]/page.tsx'
  const clientPath = basePath ? `app/${basePath}/[[...panelsPath]]/panels-client.tsx` : 'app/[[...panelsPath]]/panels-client.tsx'
  const runtimeImport = moduleSpecifier(pagePath, 'server/panels/runtime.ts')
  const rendererImport = moduleSpecifier(clientPath, '.holo-js/generated/panels/plugin-renderers.ts')
  return [
    {
      path: pagePath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `import { createPanelPage } from '@holo-js/panels-next'\nimport { panelsRuntime } from '${runtimeImport}'\nimport { PanelsClient } from './panels-client'\n\nexport default createPanelPage({ client: PanelsClient, panelId: '${panelId}', runtime: panelsRuntime })\n`,
    },
    {
      path: clientPath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `'use client'\n\nimport { createNextPanelComponentRegistry, NextPanelClient, type NextPanelClientProps } from '@holo-js/panels-next/client'\nimport { registerPanelPluginRenderers } from '${rendererImport}'\n\nconst registry = registerPanelPluginRenderers(createNextPanelComponentRegistry())\n\nexport function PanelsClient(props: Pick<NextPanelClientProps, 'payload'>) {\n  return <NextPanelClient {...props} registry={registry} />\n}\n`,
    },
  ]
}

function nuxtTemplates(panelId: string, panelPath: string): readonly ArtifactTemplate[] {
  const basePath = routePath(panelPath)
  const pagePath = basePath ? `pages/${basePath}/[[...panelsPath]].vue` : 'pages/[[...panelsPath]].vue'
  const rendererImport = moduleSpecifier(pagePath, '.holo-js/generated/panels/plugin-renderers.ts')
  return [
    {
      path: pagePath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `<script setup lang="ts">\nimport { createNuxtPanelComponentRegistry, PanelPage, usePanelPage } from '@holo-js/panels-nuxt'\nimport { registerPanelPluginRenderers } from '${rendererImport}'\n\nconst panelPage = await usePanelPage({ panelId: '${panelId}' })\nconst registry = registerPanelPluginRenderers(createNuxtPanelComponentRegistry())\n</script>\n\n<template>\n  <PanelPage :page="panelPage" :registry="registry" />\n</template>\n`,
    },
  ]
}

function svelteKitTemplates(panelId: string, panelPath: string): readonly ArtifactTemplate[] {
  const basePath = routePath(panelPath)
  const routeRoot = basePath ? `src/routes/${basePath}/[...path]` : 'src/routes/[...path]'
  const pageServerPath = `${routeRoot}/+page.server.ts`
  const registryImport = moduleSpecifier(pageServerPath, 'src/lib/server/panels/registry.ts')
  const pagePath = `${routeRoot}/+page.svelte`
  const rendererImport = moduleSpecifier(pagePath, '.holo-js/generated/panels/plugin-renderers.ts')
  return [
    {
      path: pageServerPath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `import { createPanelPageLoad } from '@holo-js/panels-sveltekit/server'\nimport { panelsRegistry } from '${registryImport}'\n\nexport const load = createPanelPageLoad({ panelId: '${panelId}', registry: panelsRegistry })\n`,
    },
    {
      path: pagePath,
      kind: 'panel-page',
      panelIds: [panelId],
      body: `<script lang="ts">\n  import { createSvelteKitPanelComponentRegistry, PanelPage } from '@holo-js/panels-sveltekit'\n  import { registerPanelPluginRenderers } from '${rendererImport}'\n\n  let { data } = $props()\n  const registry = registerPanelPluginRenderers(createSvelteKitPanelComponentRegistry())\n</script>\n\n<PanelPage {data} {registry} />\n`,
    },
  ]
}

function operationTemplate(framework: FrameworkId, panelIds: readonly string[]): ArtifactTemplate {
  const serializedPanelIds = JSON.stringify(panelIds)
  if (framework === 'next') {
    const path = 'app/_holo/panels/[panelId]/[operation]/route.ts'
    const runtimeImport = moduleSpecifier(path, 'server/panels/runtime.ts')
    return {
      path,
      kind: 'operation-endpoint',
      panelIds,
      body: `import { createPanelOperationRoute } from '@holo-js/panels-next'\nimport { panelsRuntime } from '${runtimeImport}'\n\nconst route = createPanelOperationRoute({ panelIds: ${serializedPanelIds}, runtime: panelsRuntime })\n\nexport const GET = route.GET\nexport const POST = route.POST\n`,
    }
  }
  if (framework === 'nuxt') {
    const path = 'server/api/_holo/panels/[panelId]/[operation].ts'
    const runtimeImport = moduleSpecifier(path, 'server/panels/runtime.ts')
    return {
      path,
      kind: 'operation-endpoint',
      panelIds,
      body: `import { createPanelOperationHandler } from '@holo-js/panels-nuxt/server'\nimport { panelsRuntime } from '${runtimeImport}'\n\nexport default createPanelOperationHandler({ panelIds: ${serializedPanelIds}, runtime: panelsRuntime })\n`,
    }
  }
  const path = 'src/routes/_holo/panels/[panelId]/[operation]/+server.ts'
  const registryImport = moduleSpecifier(path, 'src/lib/server/panels/registry.ts')
  return {
    path,
    kind: 'operation-endpoint',
    panelIds,
    body: `import { createPanelOperationHandler } from '@holo-js/panels-sveltekit/server'\nimport { panelsRegistry } from '${registryImport}'\n\nconst handler = createPanelOperationHandler({ panelIds: ${serializedPanelIds}, registry: panelsRegistry })\n\nexport const GET = handler.GET\nexport const POST = handler.POST\n`,
  }
}

export function frameworkArtifactTemplates(
  framework: FrameworkId,
  panels: readonly { readonly id: string, readonly path: string }[],
): readonly ArtifactTemplate[] {
  const pages = panels.flatMap((panel) => {
    if (framework === 'next') return nextTemplates(panel.id, panel.path)
    if (framework === 'nuxt') return nuxtTemplates(panel.id, panel.path)
    return svelteKitTemplates(panel.id, panel.path)
  })
  return [...pages, operationTemplate(framework, panels.map(panel => panel.id))]
}
