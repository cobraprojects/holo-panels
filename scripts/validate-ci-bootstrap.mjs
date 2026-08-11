import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const holoRoot = resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? resolve(repositoryRoot, '../holo-js'))
const expectedRepository = 'cobraprojects/holo-js'
const expectedRef = 'da8e8ee6914a6e4526a3a5006edf3ceee8545bfe'
const expectedVersion = '0.3.11'
const expectedCompatibilityRange = '>=0.3.9'
const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8')
const releaseWorkflow = await readFile(resolve(repositoryRoot, '.github/workflows/release.yml'), 'utf8')

const requiredWorkflowText = [
  `HOLO_JS_REPOSITORY: ${expectedRepository}`,
  `HOLO_JS_REF: ${expectedRef}`,
  `HOLO_JS_VERSION: ${expectedVersion}`,
  'path: holo-panels',
  'path: holo-js',
  'bun install --frozen-lockfile --ignore-scripts',
  'npm rebuild better-sqlite3',
  'node ../holo-panels/scripts/build-compatible-holo.mjs',
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
  'NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}',
  'bun install --frozen-lockfile --ignore-scripts',
  'npm rebuild better-sqlite3',
  'node ../holo-panels/scripts/build-compatible-holo.mjs',
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

const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
  cwd: holoRoot,
  encoding: 'utf8',
  timeout: 10_000,
})
const actualRef = stdout.trim()
if (actualRef !== expectedRef) {
  throw new Error(`Expected adjacent Holo-JS at ${expectedRef}, received ${actualRef}`)
}

const kernelManifest = JSON.parse(await readFile(resolve(holoRoot, 'packages/kernel/package.json'), 'utf8'))
if (kernelManifest.version !== expectedVersion) {
  throw new Error(`Expected Holo-JS ${expectedVersion}, received ${kernelManifest.version ?? '(missing)'}`)
}

const panelsManifest = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'))
for (const [packageName, version] of Object.entries(panelsManifest.workspaces?.catalog ?? {})) {
  if (packageName.startsWith('@holo-js/') && version !== expectedCompatibilityRange) {
    throw new Error(`${packageName} must use the supported Holo compatibility line ${expectedCompatibilityRange}`)
  }
}

console.log(`Validated Holo-JS ${expectedVersion} CI pin at ${expectedRef}`)
