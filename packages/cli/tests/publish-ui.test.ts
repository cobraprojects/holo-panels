import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishUi } from '../src/commands/publish-ui'
import commands from '../src/index'

const directories: string[] = []
const sourcePackageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

type Framework = 'next' | 'nuxt' | 'sveltekit'

type PackageEntry = {
  path: string
  checksum: string
}

async function fixture(framework: Framework = 'next') {
  const root = await mkdtemp(join(tmpdir(), 'panels-publish-project-'))
  const packageRoot = await mkdtemp(join(tmpdir(), 'panels-publish-package-'))
  directories.push(root, packageRoot)
  const dependency = framework === 'next' ? 'next' : framework === 'nuxt' ? 'nuxt' : '@sveltejs/kit'
  await mkdir(join(root, 'config'), { recursive: true })
  await writeFile(join(root, 'config/app.ts'), "export default { plugins: ['@holo-js/panels'] }\n")
  await writeFile(join(root, 'package.json'), `${JSON.stringify({ dependencies: { [dependency]: '1.0.0' } }, null, 2)}\n`)
  await mkdir(join(root, 'node_modules/@holo-js/panels'), { recursive: true })
  await writeFile(join(root, 'node_modules/@holo-js/panels/package.json'), '{"name":"@holo-js/panels","version":"1.2.3"}\n')
  await cp(join(sourcePackageRoot, 'publish'), join(packageRoot, 'publish'), { recursive: true })
  await writeFile(join(packageRoot, 'package.json'), `${JSON.stringify({ name: '@holo-js/panels-cli', version: '1.2.3' }, null, 2)}\n`)
  const context = {
    projectRoot: root,
    cwd: root,
    args: [] as readonly string[],
    flags: {} as Readonly<Record<string, string | boolean | number | readonly string[]>>,
    loadProject: async () => ({}),
  }
  return { context, packageRoot, root }
}

function destination(root: string, framework: Framework): string {
  return join(root, 'resources/panels/ui', framework)
}

function publication(root: string): string {
  return join(root, '.holo-js/panels/published-ui.json')
}

async function packageManifest(packageRoot: string, framework: Framework): Promise<{ version: number, framework: Framework, files: PackageEntry[] }> {
  return JSON.parse(await readFile(join(packageRoot, 'publish', framework, 'manifest.json'), 'utf8')) as { version: number, framework: Framework, files: PackageEntry[] }
}

async function writeIncoming(packageRoot: string, framework: Framework, path: string, contents?: string): Promise<void> {
  const manifestPath = join(packageRoot, 'publish', framework, 'manifest.json')
  const manifest = await packageManifest(packageRoot, framework)
  const files = manifest.files.filter(file => file.path !== path)
  if (typeof contents === 'string') {
    const sourcePath = join(packageRoot, 'publish', framework, 'src', path)
    await mkdir(dirname(sourcePath), { recursive: true })
    await writeFile(sourcePath, contents)
    files.push({ path, checksum: createHash('sha256').update(contents).digest('hex') })
  } else {
    await rm(join(packageRoot, 'publish', framework, 'src', path))
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  await writeFile(manifestPath, `${JSON.stringify({ version: 1, framework, files }, null, 2)}\n`)
}

async function writeRawIncoming(packageRoot: string, framework: Framework, path: string, contents: Uint8Array): Promise<void> {
  const manifestPath = join(packageRoot, 'publish', framework, 'manifest.json')
  const manifest = await packageManifest(packageRoot, framework)
  const sourcePath = join(packageRoot, 'publish', framework, 'src', path)
  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, contents)
  const files = manifest.files.filter(file => file.path !== path)
  files.push({ path, checksum: createHash('sha256').update(contents).digest('hex') })
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  await writeFile(manifestPath, `${JSON.stringify({ version: 1, framework, files }, null, 2)}\n`)
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('panels:publish-ui', () => {
  it.each(['next', 'nuxt', 'sveltekit'] as const)('publishes exact %s bytes to its fixed destination and records checksums', async (framework) => {
    const { context, packageRoot, root } = await fixture(framework)
    await publishUi(context, packageRoot)

    const packaged = await packageManifest(packageRoot, framework)
    const recorded = JSON.parse(await readFile(publication(root), 'utf8'))
    expect(recorded).toEqual({
      version: 1,
      framework,
      source: { package: '@holo-js/panels-cli', version: '1.2.3' },
      destination: `resources/panels/ui/${framework}`,
      files: packaged.files.map(file => ({ path: file.path, publishedChecksum: file.checksum })),
    })
    for (const file of packaged.files) {
      expect(await readFile(join(destination(root, framework), file.path))).toEqual(await readFile(join(packageRoot, 'publish', framework, 'src', file.path)))
    }
  })

  it('previews changed, added, and deleted files without writing, then applies the same clean synchronization', async () => {
    const { context, packageRoot, root } = await fixture()
    await publishUi(context, packageRoot)
    const originalManifest = await readFile(publication(root))
    const originalPanel = await readFile(join(destination(root, 'next'), 'panel-client.tsx'))
    await writeIncoming(packageRoot, 'next', 'panel-client.tsx', 'export const changed = true\n')
    await writeIncoming(packageRoot, 'next', 'added.tsx', 'export const added = true\n')
    await writeIncoming(packageRoot, 'next', 'resource-page.tsx')

    await publishUi(context, packageRoot)

    expect(await readFile(publication(root))).toEqual(originalManifest)
    expect(await readFile(join(destination(root, 'next'), 'panel-client.tsx'))).toEqual(originalPanel)
    await expect(readFile(join(destination(root, 'next'), 'added.tsx'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('--- a/resources/panels/ui/next/panel-client.tsx'))
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Preview only'))

    await publishUi({ ...context, flags: { confirm: true } }, packageRoot)

    expect(await readFile(join(destination(root, 'next'), 'panel-client.tsx'), 'utf8')).toBe('export const changed = true\n')
    expect(await readFile(join(destination(root, 'next'), 'added.tsx'), 'utf8')).toBe('export const added = true\n')
    await expect(readFile(join(destination(root, 'next'), 'resource-page.tsx'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports current source without rewriting the baseline', async () => {
    const { context, packageRoot, root } = await fixture()
    await publishUi(context, packageRoot)
    const before = await readFile(publication(root))

    await publishUi({ ...context, flags: { confirm: true } }, packageRoot)

    expect(await readFile(publication(root))).toEqual(before)
    expect(process.stdout.write).toHaveBeenLastCalledWith('[Holo Panels] Published UI is current; no changes.\n')
  })

  it('prints separated unified hunks with three lines of context', async () => {
    const { context, packageRoot } = await fixture()
    const original = Array.from({ length: 14 }, (_, index) => `line ${index + 1}`)
    await writeIncoming(packageRoot, 'next', 'diff.ts', `${original.join('\n')}\n`)
    await publishUi(context, packageRoot)
    const incoming = [...original]
    incoming[1] = 'changed near start'
    incoming[12] = 'changed near end'
    await writeIncoming(packageRoot, 'next', 'diff.ts', `${incoming.join('\n')}\n`)

    await publishUi(context, packageRoot)

    const output = vi.mocked(process.stdout.write).mock.calls.map(call => String(call[0])).join('')
    expect(output.match(/^@@ /gmu)).toHaveLength(2)
    expect(output).toContain(' line 5')
    expect(output).not.toContain(' line 6')
  })

  it('refuses local edits, missing published files, and unmanaged addition collisions without mutation', async () => {
    const edited = await fixture()
    await publishUi(edited.context, edited.packageRoot)
    await writeFile(join(destination(edited.root, 'next'), 'panel-client.tsx'), 'user edit\n')
    await expect(publishUi({ ...edited.context, flags: { confirm: true } }, edited.packageRoot)).rejects.toThrow('locally modified')
    expect(await readFile(join(destination(edited.root, 'next'), 'panel-client.tsx'), 'utf8')).toBe('user edit\n')

    const missing = await fixture()
    await publishUi(missing.context, missing.packageRoot)
    await rm(join(destination(missing.root, 'next'), 'panel-client.tsx'))
    await expect(publishUi(missing.context, missing.packageRoot)).rejects.toThrow('missing or changed type')

    const collision = await fixture()
    await publishUi(collision.context, collision.packageRoot)
    await writeIncoming(collision.packageRoot, 'next', 'collision.tsx', 'incoming\n')
    await writeFile(join(destination(collision.root, 'next'), 'collision.tsx'), 'user file\n')
    await expect(publishUi(collision.context, collision.packageRoot)).rejects.toThrow('unmanaged addition collision')
    expect(await readFile(join(destination(collision.root, 'next'), 'collision.tsx'), 'utf8')).toBe('user file\n')
  })

  it('refuses malformed inputs, unsupported arguments, tampered source, and symlinked paths', async () => {
    const invalid = await fixture()
    await expect(publishUi({ ...invalid.context, args: ['next'] }, invalid.packageRoot)).rejects.toThrow('positional')
    await expect(publishUi({ ...invalid.context, flags: { force: true } }, invalid.packageRoot)).rejects.toThrow('only --confirm')
    await expect(publishUi({ ...invalid.context, flags: { confirm: 'yes' } }, invalid.packageRoot)).rejects.toThrow('boolean')
    await writeFile(join(invalid.packageRoot, 'publish/next/src/panel-client.tsx'), 'tampered\n')
    await expect(publishUi(invalid.context, invalid.packageRoot)).rejects.toThrow('checksum mismatch')

    const linked = await fixture()
    await mkdir(join(linked.root, 'resources/panels/ui'), { recursive: true })
    await symlink(tmpdir(), destination(linked.root, 'next'))
    await expect(publishUi(linked.context, linked.packageRoot)).rejects.toThrow('symbolic link')

    const malformed = await fixture()
    await publishUi(malformed.context, malformed.packageRoot)
    const state = JSON.parse(await readFile(publication(malformed.root), 'utf8'))
    state.extra = true
    await writeFile(publication(malformed.root), JSON.stringify(state))
    await expect(publishUi(malformed.context, malformed.packageRoot)).rejects.toThrow('Invalid publication manifest')
  })

  it('rejects unsafe manifests, uncovered files, invalid text, NUL bytes, and source size limits', async () => {
    const traversal = await fixture()
    const traversalManifest = await packageManifest(traversal.packageRoot, 'next')
    traversalManifest.files[0]!.path = '../escape.ts'
    await writeFile(join(traversal.packageRoot, 'publish/next/manifest.json'), JSON.stringify(traversalManifest))
    await expect(publishUi(traversal.context, traversal.packageRoot)).rejects.toThrow('Invalid packaged UI file entry')

    const duplicate = await fixture()
    const duplicateManifest = await packageManifest(duplicate.packageRoot, 'next')
    duplicateManifest.files.push({ ...duplicateManifest.files[0]! })
    await writeFile(join(duplicate.packageRoot, 'publish/next/manifest.json'), JSON.stringify(duplicateManifest))
    await expect(publishUi(duplicate.context, duplicate.packageRoot)).rejects.toThrow('sorted and unique')

    const uncovered = await fixture()
    await writeFile(join(uncovered.packageRoot, 'publish/next/src/unlisted.ts'), 'unlisted\n')
    await expect(publishUi(uncovered.context, uncovered.packageRoot)).rejects.toThrow('does not exactly cover')

    const invalidUtf8 = await fixture()
    await writeRawIncoming(invalidUtf8.packageRoot, 'next', 'invalid.ts', new Uint8Array([0xc3, 0x28]))
    await expect(publishUi(invalidUtf8.context, invalidUtf8.packageRoot)).rejects.toThrow('not valid UTF-8')

    const nul = await fixture()
    await writeRawIncoming(nul.packageRoot, 'next', 'nul.ts', new Uint8Array([65, 0, 66]))
    await expect(publishUi(nul.context, nul.packageRoot)).rejects.toThrow('NUL byte')

    const oversized = await fixture()
    await writeRawIncoming(oversized.packageRoot, 'next', 'large.ts', new Uint8Array(2 * 1024 * 1024 + 1).fill(65))
    await expect(publishUi(oversized.context, oversized.packageRoot)).rejects.toThrow('exceeds 2 MiB')

    const total = await fixture()
    const twoMiB = new Uint8Array(2 * 1024 * 1024).fill(65)
    for (let index = 0; index < 17; index += 1) await writeRawIncoming(total.packageRoot, 'next', `large-${String(index).padStart(2, '0')}.ts`, twoMiB)
    await expect(publishUi(total.context, total.packageRoot)).rejects.toThrow('exceeds 32 MiB')
  })

  it('rolls back changed, added, and deleted files when a later mutation fails', async () => {
    const { context, packageRoot, root } = await fixture()
    await publishUi(context, packageRoot)
    const beforeManifest = await readFile(publication(root))
    const beforePanel = await readFile(join(destination(root, 'next'), 'panel-client.tsx'))
    const beforeResource = await readFile(join(destination(root, 'next'), 'resource-page.tsx'))
    await writeIncoming(packageRoot, 'next', 'panel-client.tsx', 'changed\n')
    await writeIncoming(packageRoot, 'next', 'added.tsx', 'added\n')
    await writeIncoming(packageRoot, 'next', 'resource-page.tsx')

    await expect(publishUi({ ...context, flags: { confirm: true } }, packageRoot, {
      beforeMutation(kind) {
        if (kind === 'manifest') throw new Error('injected manifest write failure')
      },
    })).rejects.toThrow('injected manifest write failure')

    expect(await readFile(publication(root))).toEqual(beforeManifest)
    expect(await readFile(join(destination(root, 'next'), 'panel-client.tsx'))).toEqual(beforePanel)
    expect(await readFile(join(destination(root, 'next'), 'resource-page.tsx'))).toEqual(beforeResource)
    await expect(readFile(join(destination(root, 'next'), 'added.tsx'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['change', 'delete'] as const)('rolls back an injected %s filesystem failure', async (failureKind) => {
    const { context, packageRoot, root } = await fixture()
    await publishUi(context, packageRoot)
    const target = failureKind === 'change' ? 'panel-client.tsx' : 'resource-page.tsx'
    const before = await readFile(join(destination(root, 'next'), target))
    if (failureKind === 'change') await writeIncoming(packageRoot, 'next', target, 'changed\n')
    else await writeIncoming(packageRoot, 'next', target)

    await expect(publishUi({ ...context, flags: { confirm: true } }, packageRoot, {
      afterMutation(kind) {
        if (kind === failureKind) throw new Error(`injected ${failureKind} failure`)
      },
    })).rejects.toThrow(`injected ${failureKind} failure`)

    expect(await readFile(join(destination(root, 'next'), target))).toEqual(before)
  })

  it('preserves published UI and its baseline during uninstall', async () => {
    const { context, packageRoot, root } = await fixture()
    await publishUi(context, packageRoot)
    const before = await readFile(publication(root))
    const source = await readFile(join(destination(root, 'next'), 'panel-client.tsx'))

    await commands.find(command => command.name === 'panels:uninstall')!.run(context)

    expect(await readFile(publication(root))).toEqual(before)
    expect(await readFile(join(destination(root, 'next'), 'panel-client.tsx'))).toEqual(source)
  })
})
