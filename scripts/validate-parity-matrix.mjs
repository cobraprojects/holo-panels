import { access } from 'node:fs/promises'

const parityMatrix = new URL('../plans/parity-matrix.json', import.meta.url)

try {
  await access(parityMatrix)
} catch {
  console.log('Parity matrix is not required until Phase P16')
  process.exit(0)
}

const { default: matrix } = await import(parityMatrix, { with: { type: 'json' } })

if (!Array.isArray(matrix) || matrix.length === 0) {
  throw new Error('The parity matrix must contain at least one feature')
}

const allowedStatuses = new Set(['implemented', 'intentionally-different', 'deferred', 'not-applicable'])
for (const item of matrix) {
  if (typeof item.id !== 'string' || !allowedStatuses.has(item.status)) {
    throw new Error('Every parity item must have a stable ID and classified status')
  }
}

console.log(`Validated ${matrix.length} parity items`)
