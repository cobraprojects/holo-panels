import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const packagesRoot = resolve(repositoryRoot, 'packages')
const reportRoot = resolve(repositoryRoot, 'coverage')
const metricNames = Object.freeze(['statements', 'branches', 'functions', 'lines'])

function isMetric(value) {
  return value !== null
    && typeof value === 'object'
    && Number.isSafeInteger(value.covered)
    && Number.isSafeInteger(value.total)
}

function percentage(covered, total) {
  return total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2))
}

async function packageDirectories() {
  const entries = await readdir(packagesRoot, { withFileTypes: true })
  const directories = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue
    const directory = join(packagesRoot, entry.name)
    const configuration = await readFile(join(directory, 'vitest.config.ts'), 'utf8').catch(() => null)
    if (configuration !== null) directories.push(Object.freeze({ directory, name: entry.name }))
  }
  return Object.freeze(directories)
}

async function runPackageCoverage(entry) {
  const reportsDirectory = join(reportRoot, entry.name)
  const { stdout, stderr } = await execFileAsync('bunx', [
    'vitest',
    '--run',
    '--reporter=dot',
    '--coverage.enabled',
    '--coverage.provider=v8',
    '--coverage.reporter=json-summary',
    `--coverage.reportsDirectory=${reportsDirectory}`,
    '--coverage.include=src/**/*.{ts,tsx,svelte}',
  ], {
    cwd: entry.directory,
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  })
  await writeFile(join(reportRoot, `${entry.name}.log`), `${stdout}${stderr}`)
  const parsed = JSON.parse(await readFile(join(reportsDirectory, 'coverage-summary.json'), 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || parsed.total === null || typeof parsed.total !== 'object') {
    throw new Error(`Coverage summary for ${entry.name} does not contain totals`)
  }
  const metrics = {}
  for (const name of metricNames) {
    const metric = parsed.total[name]
    if (!isMetric(metric)) throw new Error(`Coverage summary for ${entry.name} has an invalid ${name} metric`)
    metrics[name] = Object.freeze({
      covered: metric.covered,
      percentage: percentage(metric.covered, metric.total),
      total: metric.total,
    })
  }
  return Object.freeze({ metrics: Object.freeze(metrics), package: entry.name })
}

await rm(reportRoot, { recursive: true, force: true })
await mkdir(reportRoot, { recursive: true })

const packages = []
for (const entry of await packageDirectories()) packages.push(await runPackageCoverage(entry))

const aggregate = {}
for (const name of metricNames) {
  const covered = packages.reduce((total, entry) => total + entry.metrics[name].covered, 0)
  const total = packages.reduce((sum, entry) => sum + entry.metrics[name].total, 0)
  aggregate[name] = Object.freeze({ covered, percentage: percentage(covered, total), total })
}

const report = Object.freeze({
  aggregate: Object.freeze(aggregate),
  packages: Object.freeze(packages),
  version: 1,
})
await writeFile(join(reportRoot, 'workspace-summary.json'), `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
