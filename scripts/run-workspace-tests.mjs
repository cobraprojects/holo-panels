import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadBuildPackages } from './build-compatible-holo.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const maximumFailureOutputLength = 20_000

function boundedOutput(value) {
  const output = typeof value === 'string' ? value.trim() : ''
  if (output.length <= maximumFailureOutputLength) return output
  return `${output.slice(0, maximumFailureOutputLength)}\n[output truncated]`
}

export function summarizeVitestReport(packageName, output) {
  let report
  for (const line of output.trim().split('\n').reverse()) {
    try {
      report = JSON.parse(line)
      break
    } catch {
      continue
    }
  }
  if (!report) {
    throw new Error(`${packageName} did not emit a valid Vitest JSON report`)
  }

  if (
    report.success !== true
    || !Number.isInteger(report.numTotalTestSuites)
    || !Number.isInteger(report.numPassedTestSuites)
    || !Number.isInteger(report.numTotalTests)
    || !Number.isInteger(report.numPassedTests)
  ) {
    throw new Error(`${packageName} emitted an unsuccessful or incomplete Vitest JSON report`)
  }

  return `${packageName}: ${report.numPassedTestSuites}/${report.numTotalTestSuites} suites and ${report.numPassedTests}/${report.numTotalTests} tests passed`
}

export async function runWorkspaceTests(workspaceRoot, spawn = spawnSync) {
  const packages = await loadBuildPackages(workspaceRoot)
  for (const entry of packages) {
    const result = spawn('bun', ['run', 'test'], {
      cwd: entry.packageRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
      const output = boundedOutput([result.stderr, result.stdout].filter(Boolean).join('\n'))
      throw new Error(`Failed to test ${entry.name} with status ${result.status ?? 'unknown'}${output ? `\n${output}` : ''}`)
    }
    console.log(summarizeVitestReport(entry.name, result.stdout))
  }
  console.log(`Tested ${packages.length} packages sequentially`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (invokedPath === import.meta.url) {
  await runWorkspaceTests(resolve(repositoryRoot))
}
