import type { RegisteredAction } from '../actions/registration'

export function infolistComponents(infolist: object | undefined): readonly object[] {
  const visited = new Set<object>()
  const collect = (value: unknown): object[] => {
    if (!value || typeof value !== 'object' || visited.has(value)) return []
    visited.add(value)
    if (Array.isArray(value)) return value.flatMap(collect)
    if ('getComponents' in value && typeof value.getComponents === 'function') return collect(value.getComponents())
    const compiled = 'compile' in value && typeof value.compile === 'function' ? value.compile() : value
    if (!compiled || typeof compiled !== 'object') return []
    const manifest = Reflect.get(compiled, 'manifest') ?? compiled
    if ('path' in manifest || 'source' in manifest) return [compiled]
    const properties = Reflect.get(manifest, 'properties')
    return [Reflect.get(compiled, 'entries'), Reflect.get(compiled, 'fields'), Reflect.get(manifest, 'children'), properties && typeof properties === 'object' ? Reflect.get(properties, 'children') : undefined].flatMap(collect)
  }
  return Object.freeze(collect(infolist))
}

export function collectInfolistActions<TRecord>(infolist: object | undefined): readonly (RegisteredAction<TRecord> & { readonly source: string })[] {
  const identifiers = new Set<string>()
  return Object.freeze(infolistComponents(infolist).flatMap((compiled, index) => {
    const manifest = Reflect.get(compiled, 'manifest') ?? compiled
    const server = Reflect.get(compiled, 'server')
    const actions = server && typeof server === 'object' ? Reflect.get(server, 'actions') : undefined
    const source = `infolist:${Reflect.get(manifest, 'path') ?? index}`
    return Array.isArray(actions) ? actions.map((action: RegisteredAction<TRecord>) => {
      const key = `${source}:${action.id}`
      if (identifiers.has(key)) throw new Error(`Ambiguous infolist action "${action.id}" at "${source}"`)
      identifiers.add(key)
      return { ...action, source }
    }) : []
  }))
}
