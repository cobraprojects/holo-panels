import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const holoRoot = resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? resolve(repositoryRoot, '../holo-js'))
const expectedRepository = 'cobraprojects/holo-js'
const expectedRef = '3dbaa68a8e7b831f06fcb010ffa1f55a7eb07969'
const expectedVersion = '0.3.12'
const expectedCompatibilityRange = '>=0.3.9'

function satisfiesCompatibilityLine(version) {
  if (typeof version !== 'string') {
    return false
  }

  const minimum = expectedCompatibilityRange.replace('>=', '').split('.').map(Number)
  const candidate = version.split('-').at(0).split('.').map(Number)
  if (candidate.length !== 3 || candidate.some(Number.isNaN)) {
    return false
  }

  for (const [index, minimumPart] of minimum.entries()) {
    if (candidate[index] > minimumPart) return true
    if (candidate[index] < minimumPart) return false
  }

  return true
}
const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8')
const releaseWorkflow = await readFile(resolve(repositoryRoot, '.github/workflows/release.yml'), 'utf8')
const hostReleaseWorkflow = await readFile(resolve(repositoryRoot, '.github/workflows/release-holo.yml'), 'utf8')

const requiredWorkflowText = [
  `HOLO_JS_REPOSITORY: ${expectedRepository}`,
  `HOLO_JS_REF: ${expectedRef}`,
  `HOLO_JS_VERSION: ${expectedVersion}`,
  'NODE_OPTIONS: --max-old-space-size=8192',
  'path: holo-panels',
  'path: holo-js',
  'bun install --frozen-lockfile --ignore-scripts',
  'npm rebuild better-sqlite3',
  'node ../holo-panels/scripts/build-compatible-holo.mjs',
  'run: bun run link:holo',
  'run: bun run validate',
]

for (const requiredText of requiredWorkflowText) {
  if (!workflow.includes(requiredText)) {
    throw new Error(`CI is missing required compatibility bootstrap text: ${requiredText}`)
  }
}

if (workflow.includes('Validate P0-B')) {
  throw new Error('CI must run the complete validation gate against the published Holo host baseline')
}

const requiredReleaseWorkflowText = [
  'workflow_dispatch:',
  'environment: npm-release',
  `HOLO_JS_REPOSITORY: ${expectedRepository}`,
  `HOLO_JS_REF: ${expectedRef}`,
  `HOLO_JS_VERSION: ${expectedVersion}`,
  'NODE_OPTIONS: --max-old-space-size=8192',
  'NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}',
  'bun install --frozen-lockfile --ignore-scripts',
  'npm rebuild better-sqlite3',
  'node ../holo-panels/scripts/build-compatible-holo.mjs',
  'run: bun run link:holo',
  'run: bun run release',
]

for (const requiredText of requiredReleaseWorkflowText) {
  if (!releaseWorkflow.includes(requiredText)) {
    throw new Error(`Release CI is missing required publication text: ${requiredText}`)
  }
}

if (releaseWorkflow.includes('pull_request:') || releaseWorkflow.includes('push:')) {
  throw new Error('Release CI must only publish through explicit workflow dispatch')
}

const requiredHostReleaseWorkflowText = [
  'workflow_dispatch:',
  'environment: npm-release',
  `HOLO_JS_REPOSITORY: ${expectedRepository}`,
  `HOLO_JS_REF: ${expectedRef}`,
  `HOLO_JS_VERSION: ${expectedVersion}`,
  'NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}',
  'bun install --frozen-lockfile --ignore-scripts',
  'npm rebuild better-sqlite3',
  'bun run typecheck',
  'bun run lint',
  'bun run test',
  'run: bun run release',
]

for (const requiredText of requiredHostReleaseWorkflowText) {
  if (!hostReleaseWorkflow.includes(requiredText)) {
    throw new Error(`Holo release CI is missing required publication text: ${requiredText}`)
  }
}

if (hostReleaseWorkflow.includes('pull_request:') || hostReleaseWorkflow.includes('push:')) {
  throw new Error('Holo release CI must only publish through explicit workflow dispatch')
}

const enforcesPinnedRevision = process.env.CI === 'true'
const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
  cwd: holoRoot,
  encoding: 'utf8',
  timeout: 10_000,
})
const actualRef = stdout.trim()
if (enforcesPinnedRevision && actualRef !== expectedRef) {
  throw new Error(`Expected adjacent Holo-JS at ${expectedRef}, received ${actualRef}`)
}

const kernelManifest = JSON.parse(await readFile(resolve(holoRoot, 'packages/kernel/package.json'), 'utf8'))
if (enforcesPinnedRevision && kernelManifest.version !== expectedVersion) {
  throw new Error(`Expected Holo-JS ${expectedVersion}, received ${kernelManifest.version ?? '(missing)'}`)
}

if (!satisfiesCompatibilityLine(kernelManifest.version)) {
  throw new Error(`Adjacent Holo-JS ${kernelManifest.version ?? '(missing)'} does not satisfy ${expectedCompatibilityRange}`)
}

const panelsManifest = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'))
for (const [packageName, version] of Object.entries(panelsManifest.workspaces?.catalog ?? {})) {
  if (packageName.startsWith('@holo-js/') && version !== expectedCompatibilityRange) {
    throw new Error(`${packageName} must use the supported Holo compatibility line ${expectedCompatibilityRange}`)
  }
}

console.log(enforcesPinnedRevision
  ? `Validated Holo-JS ${expectedVersion} CI pin at ${expectedRef}`
  : `Validated adjacent Holo-JS ${kernelManifest.version} against compatibility line ${expectedCompatibilityRange}`)
