export type RegistryKind =
  | 'action'
  | 'column'
  | 'entry'
  | 'field'
  | 'filter'
  | 'page'
  | 'resource-extension'
  | 'schema-component'
  | 'summary'
  | 'widget'

declare const extensionTypeIdBrand: unique symbol

export type ExtensionTypeId<TKind extends RegistryKind = RegistryKind> = string & {
  readonly [extensionTypeIdBrand]: TKind
}

const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

export function createExtensionTypeId<TKind extends RegistryKind>(
  namespace: string,
  kind: TKind,
  name: string,
): ExtensionTypeId<TKind> {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(`Invalid extension namespace ${namespace}`)
  }

  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid ${kind} extension name ${name}`)
  }

  return `${namespace}:${kind}:${name}` as ExtensionTypeId<TKind>
}
