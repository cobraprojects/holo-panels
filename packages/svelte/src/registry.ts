import type { Component } from 'svelte'
import { rendererRegistryName, type ExtensionTypeId, type RegistryKind } from '@holo-js/panels-client'

export type SveltePanelComponent<TProperties extends object = Record<string, unknown>> = Component<TProperties>

export interface SvelteComponentRegistration<TProperties extends object = Record<string, unknown>> {
  readonly component: SveltePanelComponent<TProperties>
  readonly source: string
  readonly typeId: string
}

interface StoredSvelteComponentRegistration {
  readonly component: unknown
  readonly source: string
  readonly typeId: string
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[._:-][a-z][a-z0-9-]*)*$/u.test(value)) {
    throw new Error(`[Holo Panels] Invalid ${label} "${value}".`)
  }
}

function assertPanelId(panelId: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(panelId)) {
    throw new Error(`[Holo Panels] Invalid panel ID "${panelId}".`)
  }
}

export class SvelteComponentRegistry {
  readonly #components = new Map<string, StoredSvelteComponentRegistration>()
  readonly #overrides = new Map<string, Map<string, StoredSvelteComponentRegistration>>()

  register<TProperties extends object>(
    registration: SvelteComponentRegistration<TProperties>,
  ): () => void {
    assertIdentifier(registration.typeId, 'Svelte component type ID')
    if (this.#components.has(registration.typeId)) {
      throw new Error(`[Holo Panels] Duplicate Svelte component registration "${registration.typeId}" from ${registration.source}.`)
    }
    this.#components.set(registration.typeId, registration)
    return () => this.#components.delete(registration.typeId)
  }

  override<TProperties extends object>(
    panelId: string,
    registration: SvelteComponentRegistration<TProperties>,
  ): () => void {
    assertPanelId(panelId)
    assertIdentifier(registration.typeId, 'Svelte component type ID')
    const panelOverrides = this.#overrides.get(panelId) ?? new Map<string, StoredSvelteComponentRegistration>()
    if (panelOverrides.has(registration.typeId)) {
      throw new Error(`[Holo Panels] Duplicate Svelte component override "${registration.typeId}" for panel "${panelId}" from ${registration.source}.`)
    }
    panelOverrides.set(registration.typeId, registration)
    this.#overrides.set(panelId, panelOverrides)
    return () => {
      panelOverrides.delete(registration.typeId)
      if (panelOverrides.size === 0) this.#overrides.delete(panelId)
    }
  }

  hasRenderer(typeId: string, panelId?: string): boolean {
    return (panelId ? this.#overrides.get(panelId)?.has(typeId) : false) || this.#components.has(typeId)
  }

  resolve<TProperties extends object>(
    typeId: string,
    panelId?: string,
    requestedFrom = 'compiled panel schema',
  ): SveltePanelComponent<TProperties> {
    const registration = (panelId ? this.#overrides.get(panelId)?.get(typeId) : undefined)
      ?? this.#components.get(typeId)
    if (!registration) {
      const scope = panelId ? ` in panel "${panelId}"` : ''
      throw new Error(`[Holo Panels] Missing Svelte component registration "${typeId}"${scope}. Requested from ${requestedFrom}.`)
    }
    return registration.component as SveltePanelComponent<TProperties>
  }
}

export function registerSvelteExtensionRenderer<TProperties extends object>(
  registry: SvelteComponentRegistry,
  kind: RegistryKind,
  typeId: ExtensionTypeId,
  component: Component<TProperties>,
  source = 'application',
): SvelteComponentRegistry {
  registry.register({ component, source, typeId: rendererRegistryName(kind, typeId) })
  return registry
}
