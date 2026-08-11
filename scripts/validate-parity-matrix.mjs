import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const parityDocument = new URL('../docs/filament-5-parity.md', import.meta.url)
const expectedTopicCount = 161
const expectedUrlSetDigest = '224e939242b4fcdf6a670a8b793bf953bd57b5a8b6943564f2e13697385cf8fa'
const officialIndex = 'https://filamentphp.com/docs/llms.txt'
const allowedClassifications = new Set(['Implemented', 'Intentionally different', 'Not applicable'])
const source = await readFile(parityDocument, 'utf8')
const rows = source
  .split('\n')
  .filter(line => line.startsWith('| ['))
  .map((line, index) => {
    const match = line.match(/^\| \[[^\]]+\]\((https:\/\/filamentphp\.com\/docs\/5\.x\/[^)]+)\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/u)
    if (!match) throw new Error(`Invalid Filament parity row ${index + 1}`)
    const [, url, classification, rationale, evidence] = match
    return {
      classification: classification.trim(),
      evidence: evidence.trim(),
      rationale: rationale.trim(),
      url: url.replace(/\.md$/u, ''),
    }
  })

if (rows.length !== expectedTopicCount) {
  throw new Error(`Expected ${expectedTopicCount} Filament 5 topics from ${officialIndex}, received ${rows.length}`)
}

const urls = rows.map(row => row.url)
const uniqueUrls = new Set(urls)
if (uniqueUrls.size !== rows.length) throw new Error('Filament parity topic URLs must be unique')

const digest = createHash('sha256').update([...uniqueUrls].sort().join('\n')).digest('hex')
if (digest !== expectedUrlSetDigest) {
  throw new Error(`Filament parity URL set differs from the ${expectedTopicCount}-topic ${officialIndex} snapshot`)
}

for (const row of rows) {
  if (!allowedClassifications.has(row.classification)) {
    throw new Error(`Filament parity topic ${row.url} has unsupported classification ${row.classification}`)
  }
  if (!row.rationale) throw new Error(`Filament parity topic ${row.url} requires a rationale`)
  if (!/^\[[^\]]+\]\((?:\.\.\/|[a-z0-9-]+\.md)/u.test(row.evidence)) {
    throw new Error(`Filament parity topic ${row.url} requires repository evidence`)
  }
}

console.log(`Validated the exact ${rows.length}-topic Filament 5 parity set with no deferred rows`)
