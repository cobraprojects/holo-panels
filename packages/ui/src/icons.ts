export const panelIconNames = [
  'add',
  'alert',
  'arrow-left',
  'arrow-right',
  'check',
  'chevron-down',
  'chevron-up',
  'close',
  'delete',
  'edit',
  'external-link',
  'filter',
  'menu',
  'more',
  'search',
  'settings',
  'sort',
  'upload',
  'user',
] as const

export type PanelIconName = (typeof panelIconNames)[number] | (string & {})

export interface PanelIconPath {
  readonly path: string
  readonly fill?: 'currentColor' | 'none'
  readonly stroke?: 'currentColor' | 'none'
  readonly strokeWidth?: number
}

export interface PanelIconDefinition<TName extends PanelIconName = PanelIconName> {
  readonly name: TName
  readonly viewBox: `${number} ${number} ${number} ${number}`
  readonly paths: readonly PanelIconPath[]
}

export interface PanelIconRegistrationOptions {
  readonly replace?: boolean
}

export class PanelIconRegistry {
  readonly #icons: Map<PanelIconName, PanelIconDefinition>

  constructor(definitions: readonly PanelIconDefinition[] = []) {
    this.#icons = new Map()
    for (const definition of definitions) {
      this.register(definition)
    }
  }

  register<TName extends PanelIconName>(
    definition: PanelIconDefinition<TName>,
    options: PanelIconRegistrationOptions = {},
  ): this {
    const name = definition.name.trim()
    if (!name) {
      throw new Error('Panel icon names cannot be empty')
    }
    if (this.#icons.has(name) && !options.replace) {
      throw new Error(`Panel icon "${name}" is already registered`)
    }
    if (definition.paths.length === 0) {
      throw new Error(`Panel icon "${name}" must define at least one path`)
    }

    this.#icons.set(name, Object.freeze({
      ...definition,
      name,
      paths: Object.freeze(definition.paths.map(path => Object.freeze({ ...path }))),
    }))
    return this
  }

  has(name: PanelIconName): boolean {
    return this.#icons.has(name)
  }

  get(name: PanelIconName): PanelIconDefinition {
    const definition = this.#icons.get(name)
    if (!definition) {
      throw new Error(`Panel icon "${name}" is not registered`)
    }
    return definition
  }

  entries(): readonly PanelIconDefinition[] {
    return Object.freeze([...this.#icons.values()])
  }

  scoped(): PanelIconRegistry {
    return new PanelIconRegistry(this.entries())
  }
}

export function definePanelIcon<TName extends PanelIconName>(
  definition: PanelIconDefinition<TName>,
): PanelIconDefinition<TName> {
  return definition
}
