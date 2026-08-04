import {
  assertJsonSafe,
  serializeManifest,
  type JsonValue,
  type NodeKind,
  type PublicNode,
} from '@holo-js/panels-core'

interface RendererRegistryContract {
  hasRenderer(typeId: string, panelId?: string): boolean
}

export function assertDefinitionKind<TKind extends NodeKind>(
  node: PublicNode,
  kind: TKind,
): asserts node is Extract<PublicNode, { kind: TKind }> {
  if (node.kind !== kind) {
    throw new Error(`Expected definition kind ${kind}, received ${node.kind}`)
  }
}

export function stateRoundTrip<TState extends JsonValue>(state: TState): TState {
  return JSON.parse(serializeManifest(state)) as TState
}

export function assertCommonCapabilities<TDefinition extends object>(
  definition: TDefinition,
  capabilities: readonly (keyof TDefinition)[],
): void {
  for (const capability of capabilities) {
    if (!(capability in definition)) {
      throw new Error(`Definition is missing capability ${String(capability)}`)
    }
  }
}

export function assertManifestSafe(value: unknown): asserts value is JsonValue {
  assertJsonSafe(value)
}

export function assertRendererAvailable(
  registry: RendererRegistryContract,
  typeId: string,
  panelId?: string,
): void {
  if (!registry.hasRenderer(typeId, panelId)) {
    throw new Error(panelId
      ? `Expected renderer ${typeId} to be available in panel ${panelId}`
      : `Expected renderer ${typeId} to be available`)
  }
}
