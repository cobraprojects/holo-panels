export type FrameworkId = 'next' | 'nuxt' | 'sveltekit'

export type GeneratorKind =
  | 'action'
  | 'cluster'
  | 'exporter'
  | 'filter'
  | 'form-field'
  | 'importer'
  | 'infolist-entry'
  | 'page'
  | 'panel'
  | 'relation-manager'
  | 'resource'
  | 'resource-page'
  | 'table-column'
  | 'widget'

export type ModelFieldMetadata = {
  readonly name: string
  readonly type: string
  readonly nullable?: boolean
}

export type ModelRelationMetadata = {
  readonly name: string
  readonly target: string
  readonly kind: 'belongsTo' | 'hasMany' | 'hasOne' | 'manyToMany'
}

export type ModelMetadata = {
  readonly name: string
  readonly exportName?: string
  readonly importPath: string
  readonly fields: readonly ModelFieldMetadata[]
  readonly relations?: readonly ModelRelationMetadata[]
  readonly table?: string
}

export type GeneratorProject = {
  readonly config?: {
    readonly paths?: {
      readonly generatedSchema?: string
    }
  }
  readonly framework?: FrameworkId
  readonly manifestPath?: string
  readonly models?: readonly ModelMetadata[]
}

export type GeneratorRequest = {
  readonly args: readonly string[]
  readonly flags: Readonly<Record<string, string | boolean | number | readonly string[]>>
  readonly kind: GeneratorKind
  readonly projectRoot: string
  readonly project?: GeneratorProject
}

export type GeneratedFile = {
  readonly contents: string
  readonly path: string
}

export type GenerateOptions = {
  readonly prepare: () => Promise<void>
}
