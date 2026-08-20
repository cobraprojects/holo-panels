function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadExampleExport<TFixture>(
  framework: 'next' | 'nuxt' | 'sveltekit',
  moduleName: string,
  exportName: string,
): Promise<TFixture> {
  const moduleUrl = new URL(`../../../apps/example-${framework}/tests/${moduleName}.ts`, import.meta.url)
  const loaded: unknown = await import(moduleUrl.href)
  if (!isRecord(loaded) || !(exportName in loaded)) throw new Error(`Missing ${exportName} in ${moduleName}`)
  return Reflect.get(loaded, exportName) as TFixture
}

export async function loadExampleSchema(framework: 'next' | 'nuxt' | 'sveltekit'): Promise<void> {
  const moduleUrl = new URL(`../../../apps/example-${framework}/.holo-js/generated/schema.generated.ts`, import.meta.url)
  await import(moduleUrl.href)
}
