import type { NextPanelsRuntime } from '@holo-js/panels-next'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import CreatePost from '../server/admin/pages/posts/CreatePost'
import EditPost from '../server/admin/pages/posts/EditPost'
import ListPosts from '../server/admin/pages/posts/ListPosts'
import ViewPost from '../server/admin/pages/posts/ViewPost'

const pageKeys = Object.freeze([
  'admin:page:posts',
  'admin:page:posts-create',
  'admin:page:posts-view',
  'admin:page:posts-edit',
] as const)

function projectRoot(): string {
  const workingDirectory = process.cwd()
  return workingDirectory.includes('/packages/') || workingDirectory.includes('/apps/')
    ? resolve(workingDirectory, '../..')
    : workingDirectory
}

async function loadRuntimeModule(path: string): Promise<object> {
  return import(pathToFileURL(resolve(projectRoot(), path)).href)
}

export async function loadNextPanelsRuntime(): Promise<NextPanelsRuntime> {
  const module = await loadRuntimeModule('apps/example-next/server/panels/runtime.ts')
  const runtime = Reflect.get(module, 'panelsRuntime')
  if (!runtime || typeof runtime !== 'object' || !('registry' in runtime)) throw new Error('Missing exported Next panels runtime')
  return runtime as NextPanelsRuntime
}

export async function createNextPanelsAcceptanceRuntime(overrides: object): Promise<NextPanelsRuntime> {
  const module = await loadRuntimeModule('apps/example-next/server/admin/runtime.ts')
  const factory: unknown = Reflect.get(module, 'createAdminPanelsRuntime')
  if (typeof factory !== 'function') throw new Error('Missing exported Next panels runtime factory')
  const runtime: unknown = Reflect.apply(factory, undefined, [overrides])
  if (!runtime || typeof runtime !== 'object' || !('registry' in runtime)) throw new Error('Invalid Next panels runtime factory result')
  return runtime as NextPanelsRuntime
}

export const nextPanelAcceptanceFixture = Object.freeze({
  createRuntime: createNextPanelsAcceptanceRuntime,
  framework: 'next',
  loadRuntime: loadNextPanelsRuntime,
  pageKeys,
  pages: Object.freeze([
    ListPosts.compile(),
    CreatePost.compile(),
    ViewPost.compile(),
    EditPost.compile(),
  ]),
})
