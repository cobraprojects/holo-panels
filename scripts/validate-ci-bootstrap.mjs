import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const expectedRepository = 'cobraprojects/holo-js'
const expectedCompatibilityRange = '>=0.3.9'
const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8')
const releaseWorkflow = await readFile(resolve(repositoryRoot, '.github/workflows/release.yml'), 'utf8')
const hostReleaseWorkflow = await readFile(resolve(repositoryRoot, '.github/workflows/release-holo.yml'), 'utf8')

const forbiddenRegistryBypassText = [
  'HOLO_JS_REF',
  'build-compatible-holo.mjs',
  'bun run link:holo',
]

const requiredWorkflowText = [
  'bun install --frozen-lockfile',
  'node scripts/validate-ci-bootstrap.mjs',
  'run: bun run validate',
]

for (const requiredText of requiredWorkflowText) {
  if (!workflow.includes(requiredText)) {
    throw new Error(`CI is missing required bootstrap text: ${requiredText}`)
  }
}

if (workflow.includes('Validate P0-B')) {
  throw new Error('CI must run the complete validation gate against the published Holo host baseline')
}

const requiredReleaseWorkflowText = [
  'workflow_dispatch:',
  'environment: npm-release',
  'NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}',
  'bun install --frozen-lockfile',
  'node scripts/validate-ci-bootstrap.mjs',
  'run: bun run release',
]

for (const requiredText of requiredReleaseWorkflowText) {
  if (!releaseWorkflow.includes(requiredText)) {
    throw new Error(`Release CI is missing required publication text: ${requiredText}`)
  }
}

for (const [workflowName, contents] of [['CI', workflow], ['Release CI', releaseWorkflow]]) {
  for (const forbiddenText of forbiddenRegistryBypassText) {
    if (contents.includes(forbiddenText)) {
      throw new Error(`${workflowName} must resolve Holo-JS from the registry, not an adjacent checkout: ${forbiddenText}`)
    }
  }
}

if (releaseWorkflow.includes('pull_request:') || releaseWorkflow.includes('push:')) {
  throw new Error('Release CI must only publish through explicit workflow dispatch')
}

const requiredHostReleaseWorkflowText = [
  'workflow_dispatch:',
  'environment: npm-release',
  `HOLO_JS_REPOSITORY: ${expectedRepository}`,
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

const panelsManifest = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'))
for (const [packageName, version] of Object.entries(panelsManifest.workspaces?.catalog ?? {})) {
  if (packageName.startsWith('@holo-js/') && version !== expectedCompatibilityRange) {
    throw new Error(`${packageName} must use the supported Holo compatibility line ${expectedCompatibilityRange}`)
  }
}

const installedKernelManifest = JSON.parse(await readFile(
  resolve(repositoryRoot, 'node_modules/@holo-js/kernel/package.json'),
  'utf8',
))
if (!installedKernelManifest.version) {
  throw new Error('Installed @holo-js/kernel does not report a version')
}

console.log(`Validated installed Holo-JS ${installedKernelManifest.version} against compatibility line ${expectedCompatibilityRange}`)
