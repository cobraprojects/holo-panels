import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const updateFixtures = process.argv.includes('--update')
const packages = [
  {
    build: true,
    declaration: 'packages/core/dist/index.d.ts',
    fixture: 'tests/fixtures/public-api/panels-core.d.ts',
    name: '@holo-js/panels-core',
  },
  {
    build: true,
    declaration: 'packages/panels/dist/index.d.ts',
    fixture: 'tests/fixtures/public-api/panels.d.ts',
    name: '@holo-js/panels',
  },
]

const normalizeDeclaration = (source) => (
  `${source.replaceAll('\r\n', '\n').trimEnd()}\n`
)

const firstDifference = (expected, actual) => {
  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const lineCount = Math.max(expectedLines.length, actualLines.length)

  for (let index = 0; index < lineCount; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return {
        actual: actualLines[index] ?? '<end of file>',
        expected: expectedLines[index] ?? '<end of file>',
        line: index + 1,
      }
    }
  }

  return undefined
}

for (const packageDefinition of packages) {
  if (!packageDefinition.build) {
    continue
  }

  execFileSync(
    'bun',
    ['run', '--filter', packageDefinition.name, 'build'],
    { cwd: repositoryRoot, stdio: 'inherit' },
  )
}

let hasMismatch = false

for (const packageDefinition of packages) {
  const fixturePath = resolve(repositoryRoot, packageDefinition.fixture)
  const declaration = normalizeDeclaration(readFileSync(
    resolve(repositoryRoot, packageDefinition.declaration),
    'utf8',
  ))

  if (updateFixtures) {
    writeFileSync(fixturePath, declaration)
    console.log(`Updated ${packageDefinition.fixture}`)
    continue
  }

  const fixture = normalizeDeclaration(readFileSync(fixturePath, 'utf8'))
  const difference = firstDifference(fixture, declaration)

  if (!difference) {
    console.log(`${packageDefinition.name} public API matches its declaration fixture`)
    continue
  }

  hasMismatch = true
  console.error(`${packageDefinition.name} public API changed at line ${difference.line}`)
  console.error(`Expected: ${difference.expected}`)
  console.error(`Actual:   ${difference.actual}`)
}

if (hasMismatch) {
  console.error('Review the public API change, then run node scripts/validate-public-api.mjs --update')
  process.exitCode = 1
}
