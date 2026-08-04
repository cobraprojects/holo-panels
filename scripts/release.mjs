import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { validateNpmPublishAuthentication } from './release-auth.mjs'
import { withResolvedReleaseManifests } from './resolved-release-manifests.mjs'

const publish = process.argv.includes('--publish')
const dryRun = process.argv.includes('--dry-run')

if (publish === dryRun) throw new Error('Choose exactly one release mode: --publish or --dry-run')
if (publish && process.env.CI !== 'true') throw new Error('Publishing requires CI=true and the explicit --publish flag')
if (publish) validateNpmPublishAuthentication()

const packagesRoot = new URL('../packages/', import.meta.url)
const preferredOrder = [
  'core',
  'client',
  'ui',
  'react',
  'vue',
  'svelte',
  'plugin-money',
  'next',
  'nuxt',
  'sveltekit',
  'cli',
  'shield',
  'testing',
  'panels',
]
const packageDirectories = new Set((await readdir(packagesRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name))
const releases = []

for (const directory of preferredOrder) {
  if (!packageDirectories.delete(directory)) {
    throw new Error(`Release package is missing: ${directory}`)
  }

  const packageRoot = new URL(`../packages/${directory}/`, import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))
  releases.push({ directory, manifest, packageRoot })
}

if (packageDirectories.size > 0) {
  throw new Error(`Release order is missing packages: ${[...packageDirectories].sort().join(', ')}`)
}

const versions = new Set(releases.map(release => release.manifest.version))
if (versions.size !== 1) throw new Error(`Release packages must use one lockstep version; received ${[...versions].sort().join(', ')}`)
const version = releases[0].manifest.version
if (publish && version === '0.0.0') throw new Error('Refusing to publish the unreleased 0.0.0 workspace version')
const tag = version.includes('-') ? 'next' : 'latest'

const sourceValidation = spawnSync('bun', ['run', 'validate'], { stdio: 'inherit' })
if (sourceValidation.status !== 0) process.exit(sourceValidation.status ?? 1)

let failureStatus
await withResolvedReleaseManifests(() => {
  const validation = spawnSync(
    'node',
    ['scripts/validate-published-packages.mjs', '--require-build', '--pack'],
    { stdio: 'inherit' },
  )

  if (validation.status !== 0) {
    failureStatus = validation.status ?? 1
    return
  }

  for (const release of releases) {
    const publication = spawnSync('bun', [
      'publish',
      '--access',
      'public',
      '--tag',
      tag,
      ...(dryRun ? ['--dry-run'] : []),
    ], {
      cwd: release.packageRoot,
      stdio: 'inherit',
    })

    if (publication.status !== 0) {
      failureStatus = publication.status ?? 1
      return
    }
  }
})

if (failureStatus !== undefined) process.exit(failureStatus)

console.log(`${dryRun ? 'Dry-run validated' : 'Published'} ${releases.length} packages at ${version} with the ${tag} tag`)
