import type { ClientRegistryReference } from '../protocol/nodes'
import type { PluginCompatibility } from './compatibility'
import type { ExtensionTypeId, RegistryKind } from './type-id'

export function rendererRegistryName(kind: RegistryKind, typeId: ExtensionTypeId): string {
  return `${kind}.${typeId.replaceAll(':', '.')}`
}

export interface ExtensionRegistration<
  TKind extends RegistryKind = RegistryKind,
  TState extends object = object,
> {
  compatibility: PluginCompatibility
  kind: TKind
  pluginId: string
  renderer?: ClientRegistryReference
  state?: TState
  typeId: ExtensionTypeId<TKind>
}

export class DuplicateRegistrationError extends Error {
  constructor(typeId: string, panelId?: string) {
    super(panelId
      ? `Renderer override ${typeId} is already registered for panel ${panelId}`
      : `Extension ${typeId} is already registered`)
    this.name = 'DuplicateRegistrationError'
  }
}

export class MissingRendererError extends Error {
  readonly panelId?: string
  readonly typeId: string

  constructor(typeId: string, panelId?: string) {
    super(panelId
      ? `No renderer is registered for ${typeId} in panel ${panelId}`
      : `No renderer is registered for ${typeId}`)
    this.name = 'MissingRendererError'
    this.typeId = typeId
    this.panelId = panelId
  }
}

export class ExtensionRegistry {
  readonly #registrations = new Map<string, ExtensionRegistration>()
  readonly #rendererOverrides = new Map<string, ClientRegistryReference>()

  register<const TKind extends RegistryKind, TState extends object>(
    registration: ExtensionRegistration<TKind, TState>,
  ): ExtensionRegistration<TKind, TState> {
    if (registration.kind !== registration.typeId.split(':')[1]) {
      throw new Error(`Registration kind ${registration.kind} does not match ${registration.typeId}`)
    }

    if (this.#registrations.has(registration.typeId)) {
      throw new DuplicateRegistrationError(registration.typeId)
    }

    this.#registrations.set(registration.typeId, registration)
    return registration
  }

  overrideRenderer(
    panelId: string,
    typeId: ExtensionTypeId,
    renderer: ClientRegistryReference,
  ): void {
    if (!this.#registrations.has(typeId)) {
      throw new Error(`Cannot override unregistered extension ${typeId}`)
    }

    const key = `${panelId}\0${typeId}`

    if (this.#rendererOverrides.has(key)) {
      throw new DuplicateRegistrationError(typeId, panelId)
    }

    this.#rendererOverrides.set(key, renderer)
  }

  get<TKind extends RegistryKind, TState extends object = object>(
    typeId: ExtensionTypeId<TKind>,
  ): ExtensionRegistration<TKind, TState> | undefined {
    return this.#registrations.get(typeId) as ExtensionRegistration<TKind, TState> | undefined
  }

  renderer(typeId: ExtensionTypeId, panelId?: string): ClientRegistryReference {
    const override = panelId
      ? this.#rendererOverrides.get(`${panelId}\0${typeId}`)
      : undefined
    const renderer = override ?? this.#registrations.get(typeId)?.renderer

    if (!renderer) {
      throw new MissingRendererError(typeId, panelId)
    }

    return renderer
  }

  hasRenderer(typeId: string, panelId?: string): boolean {
    const override = panelId
      ? this.#rendererOverrides.has(`${panelId}\0${typeId}`)
      : false
    return override || this.#registrations.get(typeId)?.renderer !== undefined
  }
}
