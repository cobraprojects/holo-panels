import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  readonly exports: Readonly<Record<string, unknown>>
  readonly name: string
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const readManifest = (manifestPath: string): PackageManifest => {
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (
    typeof manifest !== 'object'
    || manifest === null
    || !('name' in manifest)
    || typeof manifest.name !== 'string'
    || !('exports' in manifest)
    || typeof manifest.exports !== 'object'
    || manifest.exports === null
  ) {
    throw new TypeError(`Invalid package manifest at ${manifestPath}`)
  }

  return manifest as unknown as PackageManifest
}

const importPath = (packageName: string, subpath: string): string => (
  subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
)

describe('generated API reference', () => {
  it('matches every current package export and built declaration', () => {
    expect(() => execFileSync(
      'bun',
      ['scripts/generate-api-reference.ts', '--check'],
      { cwd: repositoryRoot, stdio: 'pipe' },
    )).not.toThrow()

    const packagesRoot = resolve(repositoryRoot, 'packages')
    const manifests = readdirSync(packagesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readManifest(resolve(packagesRoot, entry.name, 'package.json')))
      .filter((manifest) => manifest.name.startsWith('@holo-js/panels'))
    const expectedImportPaths = manifests.flatMap((manifest) => (
      Object.keys(manifest.exports).map((subpath) => importPath(manifest.name, subpath))
    ))
    const reference = readFileSync(resolve(repositoryRoot, 'docs/api-reference.md'), 'utf8')

    expect(manifests).toHaveLength(21)
    expect(expectedImportPaths).toHaveLength(46)

    for (const expectedImportPath of expectedImportPaths) {
      expect(reference).toContain(`### \`${expectedImportPath}\``)
    }
  }, 15_000)
})
