const objectIdentities = new WeakMap<object, string>()

export function actionCacheIdentity(value: unknown): string | null {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'number' || typeof value === 'string') return JSON.stringify([typeof value, value])
  if (typeof value !== 'object') return null
  const constructor = Reflect.get(value, 'constructor')
  const repository: unknown = 'getRepository' in value && typeof value.getRepository === 'function' ? value.getRepository() : undefined
  const definition: unknown = repository && typeof repository === 'object' ? Reflect.get(repository, 'definition') : typeof constructor === 'function' ? Reflect.get(constructor, 'definition') : undefined
  const model = definition && typeof definition === 'object' ? definition : null
  const primaryKey: unknown = model ? Reflect.get(model, 'primaryKey') : 'id'
  const identifier: unknown = typeof primaryKey === 'string' ? Reflect.get(value, primaryKey) : undefined
  if (typeof identifier === 'number' || typeof identifier === 'string') {
    const name: unknown = model ? Reflect.get(model, 'name') : undefined
    return JSON.stringify([typeof name === 'string' ? name : typeof constructor === 'function' ? constructor.name : 'object', typeof identifier, identifier])
  }
  const identity = objectIdentities.get(value) ?? `object:${crypto.randomUUID()}`
  objectIdentities.set(value, identity)
  return identity
}
