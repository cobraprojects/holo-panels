import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderResourceTypeBindings } from '../src/resource-type-bindings'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'holo-panels-resource-types-'))
  temporaryDirectories.push(root)
  await mkdir(join(root, '.holo-js/generated'), { recursive: true })
  await writeFile(join(root, '.holo-js/generated/registry.json'), `${JSON.stringify({
    models: [{ exportName: 'Post', name: 'Post', sourcePath: 'server/models/Post.ts', tableName: 'posts' }],
    version: 1,
  })}\n`)
  return root
}

describe('resource type bindings', () => {
  it('binds resources and registered relation managers to Holo generated model types', async () => {
    const root = await project()
    const artifact = await renderResourceTypeBindings(root, [{
      exportName: 'default',
      modelName: 'Post',
      projectPath: 'server/admin/resources/posts/PostResource.ts',
      tableName: 'posts',
    }], [{
      exportName: 'default',
      ownerResourceExportName: 'default',
      ownerResourceProjectPath: 'server/admin/resources/posts/PostResource.ts',
      projectPath: 'server/admin/resources/posts/relation-managers/CommentsRelationManager.ts',
      relationship: 'comments',
    }])

    expect(artifact.path).toBe('resource-type-bindings.d.ts')
    expect(artifact.contents).toContain('interface ResourceTypeRegistry')
    expect(artifact.contents).toContain('typeof import("../../../server/models/Post")["Post"]')
    expect(artifact.contents).toContain('interface RelationManagerTypeRegistry')
    expect(artifact.contents).toContain('readonly relationship: "comments"')
  })

  it('fails when a resource model is absent from Holo generated metadata', async () => {
    const root = await project()

    await expect(renderResourceTypeBindings(root, [{
      exportName: 'default',
      modelName: 'Missing',
      projectPath: 'server/admin/resources/missing/MissingResource.ts',
      tableName: 'missing',
    }], [])).rejects.toThrow('Holo did not generate that model')
  })
})
