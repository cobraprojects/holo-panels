import type { Component } from 'vue'
import { rendererRegistryName, type ExtensionTypeId, type RegistryKind } from '@holo-js/panels-client'

export interface VueComponentResolution {
  readonly component: Component
  readonly source?: string
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(value)) {
    throw new Error(`[Holo Panels] Invalid ${label} identifier "${value}".`)
  }
}

function freezeResolution(component: Component, source?: string): VueComponentResolution {
  return Object.freeze({
    component,
    ...(source ? { source } : {}),
  })
}

export class ComponentRegistry {
  readonly #components = new Map<string, VueComponentResolution>()
  readonly #panelOverrides = new Map<string, Map<string, VueComponentResolution>>()

  register(name: string, component: Component, source = 'application'): this {
    assertIdentifier(name, 'Vue component')
    if (this.#components.has(name)) {
      throw new Error(`[Holo Panels] Vue component "${name}" is already registered. Use override() for a panel-scoped replacement.`)
    }
    this.#components.set(name, freezeResolution(component, source))
    return this
  }

  override(panelId: string, name: string, component: Component, source = 'application'): this {
    assertIdentifier(panelId, 'panel')
    assertIdentifier(name, 'Vue component')
    const overrides = this.#panelOverrides.get(panelId) ?? new Map<string, VueComponentResolution>()
    const existing = overrides.get(name)
    if (existing) {
      throw new Error(`[Holo Panels] Vue component "${name}" already has a ${panelId} override from ${existing.source ?? 'unknown source'}.`)
    }
    overrides.set(name, freezeResolution(component, source))
    this.#panelOverrides.set(panelId, overrides)
    return this
  }

  resolve(name: string, panelId?: string, requestedBy?: string): Component {
    const resolution = panelId
      ? this.#panelOverrides.get(panelId)?.get(name) ?? this.#components.get(name)
      : this.#components.get(name)
    if (resolution) return resolution.component
    const location = requestedBy ? ` Requested by ${requestedBy}.` : ''
    const scope = panelId ? ` for panel "${panelId}"` : ''
    throw new Error(`[Holo Panels] Missing Vue component registration "${name}"${scope}.${location}`)
  }

  has(name: string, panelId?: string): boolean {
    return panelId
      ? this.#panelOverrides.get(panelId)?.has(name) === true || this.#components.has(name)
      : this.#components.has(name)
  }

  hasRenderer(name: string, panelId?: string): boolean {
    return this.has(name, panelId)
  }
}

export function createComponentRegistry(): ComponentRegistry {
  return new ComponentRegistry()
}

export type VuePanelRendererRegistration = (registry: ComponentRegistry) => ComponentRegistry

export function defineVuePanelRenderers(registration: VuePanelRendererRegistration): VuePanelRendererRegistration {
  return registration
}

export function registerVueExtensionRenderer(
  registry: ComponentRegistry,
  kind: RegistryKind,
  typeId: ExtensionTypeId,
  component: Component,
  source = 'application',
): ComponentRegistry {
  return registry.register(rendererRegistryName(kind, typeId), component, source)
}
