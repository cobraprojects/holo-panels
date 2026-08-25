import type { ComponentType } from 'react'
import { rendererRegistryName, type ExtensionTypeId, type RegistryKind } from '@holo-js/panels-client'

export type ReactRendererComponent<TProps = object> = ComponentType<TProps>

interface RegisteredComponent {
  readonly component: ReactRendererComponent<never>
  readonly source: string
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(value)) {
    throw new Error(`[Holo Panels] Invalid ${label} "${value}".`)
  }
}

export class ComponentRegistry {
  readonly #components = new Map<string, RegisteredComponent>()
  readonly #panelOverrides = new Map<string, Map<string, RegisteredComponent>>()

  register<TProps>(name: string, component: ReactRendererComponent<TProps>, source = 'application'): this {
    assertIdentifier(name, 'React component name')
    const existing = this.#components.get(name)
    if (existing) {
      throw new Error(`[Holo Panels] React component "${name}" from ${source} conflicts with its registration from ${existing.source}.`)
    }
    this.#components.set(name, { component: component as ReactRendererComponent<never>, source })
    return this
  }

  override<TProps>(
    panelId: string,
    name: string,
    component: ReactRendererComponent<TProps>,
    source = 'application',
  ): this {
    assertIdentifier(panelId, 'panel ID')
    assertIdentifier(name, 'React component name')
    const overrides = this.#panelOverrides.get(panelId) ?? new Map<string, RegisteredComponent>()
    if (overrides.has(name)) {
      const existing = overrides.get(name)
      throw new Error(`[Holo Panels] React component "${name}" already has a ${panelId} override from ${existing?.source ?? 'unknown source'}.`)
    }
    overrides.set(name, { component: component as ReactRendererComponent<never>, source })
    this.#panelOverrides.set(panelId, overrides)
    return this
  }

  resolve<TProps>(name: string, panelId?: string, requestedFrom = 'unknown source'): ReactRendererComponent<TProps> {
    const registration = (panelId ? this.#panelOverrides.get(panelId)?.get(name) : undefined)
      ?? this.#components.get(name)
    if (!registration) {
      const location = panelId ? ` for panel "${panelId}"` : ''
      throw new Error(`[Holo Panels] Missing React component "${name}"${location}, requested from ${requestedFrom}. Register it at the resource, plugin, or application source.`)
    }
    return registration.component as ReactRendererComponent<TProps>
  }

  has(name: string, panelId?: string): boolean {
    return Boolean((panelId ? this.#panelOverrides.get(panelId)?.has(name) : false) || this.#components.has(name))
  }
}

export function createComponentRegistry(): ComponentRegistry {
  return new ComponentRegistry()
}

export type ReactPanelRendererRegistration = (registry: ComponentRegistry) => ComponentRegistry

export function defineReactPanelRenderers(registration: ReactPanelRendererRegistration): ReactPanelRendererRegistration {
  return registration
}

export function registerReactExtensionRenderer<TProps extends object>(
  registry: ComponentRegistry,
  kind: RegistryKind,
  typeId: ExtensionTypeId,
  component: ComponentType<TProps>,
  source = 'application',
): ComponentRegistry {
  return registry.register(rendererRegistryName(kind, typeId), component, source)
}

export function createDefaultComponentRegistry(): ComponentRegistry {
  return createComponentRegistry()
}
