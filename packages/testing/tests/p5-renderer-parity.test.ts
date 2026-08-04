import { createDefaultComponentRegistry as createReactRegistry } from '@holo-js/panels-react'
import { svelteShellPrimitives, SvelteComponentRegistry } from '@holo-js/panels-svelte'
import { createDefaultComponentRegistry as createVueRegistry } from '@holo-js/panels-vue'
import { describe, expect, it } from 'vitest'
import { verifyRendererFoundation, type RendererFoundationContract } from '../src/index'

function errorMessage(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('Expected renderer resolution to fail.')
}

function contracts(): readonly RendererFoundationContract[] {
  const react = createReactRegistry()
  const vue = createVueRegistry()
  const svelte = new SvelteComponentRegistry()
  return [
    {
      framework: 'react',
      hasPrimitive: name => react.has(name),
      missingDiagnostic: (name, panelId, source) => errorMessage(() => react.resolve(name, panelId, source)),
    },
    {
      framework: 'vue',
      hasPrimitive: name => vue.has(name),
      missingDiagnostic: (name, panelId, source) => errorMessage(() => vue.resolve(name, panelId, source)),
    },
    {
      framework: 'svelte',
      hasPrimitive: name => Object.hasOwn(svelteShellPrimitives, name),
      missingDiagnostic: (name, panelId, source) => errorMessage(() => svelte.resolve(name, panelId, source)),
    },
  ]
}

describe('shared renderer foundation contract', () => {
  it('keeps primitive coverage and accessibility patterns equal across React, Vue, and Svelte', () => {
    const reports = contracts().map(verifyRendererFoundation)
    expect(reports.map(report => report.framework)).toEqual(['react', 'vue', 'svelte'])
    expect(reports[1]?.primitiveNames).toEqual(reports[0]?.primitiveNames)
    expect(reports[2]?.primitiveNames).toEqual(reports[0]?.primitiveNames)
    expect(reports[1]?.requiredPatterns).toEqual(reports[0]?.requiredPatterns)
    expect(reports[2]?.requiredPatterns).toEqual(reports[0]?.requiredPatterns)
  })
})
