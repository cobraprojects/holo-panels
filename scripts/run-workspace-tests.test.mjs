import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeVitestReport } from './run-workspace-tests.mjs'

test('summarizes successful Vitest JSON reports without logging assertion payloads', () => {
  const report = JSON.stringify({
    numPassedTestSuites: 2,
    numPassedTests: 7,
    numTotalTestSuites: 2,
    numTotalTests: 7,
    success: true,
    testResults: [{ assertionResults: [{ failureMessages: [] }] }],
  })
  const summary = summarizeVitestReport('@holo-js/panels-core', `framework warning\n${report}\n`)

  assert.equal(summary, '@holo-js/panels-core: 2/2 suites and 7/7 tests passed')
})

test('rejects malformed and unsuccessful Vitest reports', () => {
  assert.throws(
    () => summarizeVitestReport('@holo-js/panels-core', 'not-json'),
    /did not emit a valid Vitest JSON report/u,
  )
  assert.throws(
    () => summarizeVitestReport('@holo-js/panels-core', JSON.stringify({ success: false })),
    /emitted an unsuccessful or incomplete Vitest JSON report/u,
  )
})
