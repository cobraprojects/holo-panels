import { componentConformanceFixtures, shellPrimitiveNames, type ShellPrimitiveName } from '@holo-js/panels-ui'

export interface RendererFoundationContract {
  readonly framework: 'react' | 'svelte' | 'vue'
  hasPrimitive(name: ShellPrimitiveName): boolean
  missingDiagnostic(name: string, panelId: string, source: string): string
}

export interface RendererFoundationReport {
  readonly framework: RendererFoundationContract['framework']
  readonly primitiveNames: readonly ShellPrimitiveName[]
  readonly requiredPatterns: readonly string[]
}

export function verifyRendererFoundation(contract: RendererFoundationContract): RendererFoundationReport {
  const missing = shellPrimitiveNames.filter(name => !contract.hasPrimitive(name))
  if (missing.length > 0) {
    throw new Error(`[Holo Panels] ${contract.framework} renderer is missing shell primitives: ${missing.join(', ')}.`)
  }
  const diagnostic = contract.missingDiagnostic('acme.missing', 'admin', 'app/panels/admin.ts')
  for (const expected of ['acme.missing', 'admin', 'app/panels/admin.ts']) {
    if (!diagnostic.includes(expected)) {
      throw new Error(`[Holo Panels] ${contract.framework} missing-component diagnostic omits ${expected}.`)
    }
  }
  return Object.freeze({
    framework: contract.framework,
    primitiveNames: Object.freeze([...shellPrimitiveNames]),
    requiredPatterns: Object.freeze([...new Set(componentConformanceFixtures.flatMap(fixture => fixture.requiredPatterns))].sort()),
  })
}
