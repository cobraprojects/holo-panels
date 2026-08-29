import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { assertDefinitionName, assertGuard, assertPanelId, assertPanelPath } from './naming'
import { renderTemplates } from './templates'
import type { FrameworkId, GeneratedFile, GenerateOptions, GeneratorProject, GeneratorRequest, ModelMetadata, ModelRelationMetadata } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function flag(request: GeneratorRequest, name: string): string | undefined {
  const value = request.flags[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function booleanFlag(request: GeneratorRequest, name: string): boolean {
  const value = request.flags[name]
  if (typeof value === 'undefined') return false
  if (typeof value !== 'boolean') throw new Error(`[Holo Panels] --${name} does not accept a value.`)
  return value
}

function forceTargets(request: GeneratorRequest): ReadonlySet<string> {
  const value = request.flags.force
  if (typeof value === 'undefined') return new Set()
  if (typeof value === 'boolean' || typeof value === 'number') {
    throw new Error('[Holo Panels] --force must name one or more exact project-relative file targets.')
  }
  const targets = typeof value === 'string' ? [value] : value
  if (targets.length === 0 || targets.some(target => !target.trim())) {
    throw new Error('[Holo Panels] --force must name one or more exact project-relative file targets.')
  }
  return new Set(targets)
}

function projectPath(projectRoot: string, projectRelativePath: string): string {
  if (!projectRelativePath || isAbsolute(projectRelativePath) || projectRelativePath.split(/[\\/]/).includes('..')) {
    throw new Error(`[Holo Panels] Invalid project-relative target: ${projectRelativePath}.`)
  }
  const root = resolve(projectRoot)
  const target = resolve(root, projectRelativePath)
  const relativePath = relative(root, target)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`[Holo Panels] Invalid project-relative target: ${projectRelativePath}.`)
  }
  return target
}

async function assertSafePath(projectRoot: string, targetPath: string): Promise<void> {
  const root = resolve(projectRoot)
  const target = projectPath(root, relative(root, targetPath))
  let current = root
  for (const segment of relative(root, target).split(sep)) {
    current = join(current, segment)
    try {
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink()) throw new Error(`[Holo Panels] Refusing symlinked generator target: ${relative(root, current)}.`)
      if (current !== target && !metadata.isDirectory()) {
        throw new Error(`[Holo Panels] Generator target parent is not a directory: ${relative(root, current)}.`)
      }
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw error
    }
  }
}

async function optionalContents(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

async function atomicWrite(projectRoot: string, target: string, contents: string, overwrite: boolean): Promise<void> {
  await assertSafePath(projectRoot, target)
  await mkdir(dirname(target), { recursive: true })
  await assertSafePath(projectRoot, target)
  if (!overwrite) {
    await writeFile(target, contents, { encoding: 'utf8', flag: 'wx' })
    return
  }
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true })
  }
}

async function detectPanel(projectRoot: string): Promise<string> {
  const serverPath = projectPath(projectRoot, 'server')
  let entries
  try {
    const { readdir } = await import('node:fs/promises')
    entries = await readdir(serverPath, { withFileTypes: true })
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') throw new Error('[Holo Panels] No panel found. Pass --panel explicitly.')
    throw error
  }
  const candidates: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-z][a-z0-9-]*$/.test(entry.name)) continue
    const expected = `${entry.name.split('-').map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join('')}Panel.ts`
    if (await optionalContents(join(serverPath, entry.name, expected))) candidates.push(entry.name)
  }
  if (candidates.length !== 1) {
    throw new Error(`[Holo Panels] ${candidates.length === 0 ? 'No panel found' : `Ambiguous panels: ${candidates.join(', ')}`}. Pass --panel explicitly.`)
  }
  return candidates[0]!
}

function frameworkFromManifest(value: unknown): FrameworkId | undefined {
  if (!isRecord(value)) return undefined
  const dependencies = { ...(isRecord(value.devDependencies) ? value.devDependencies : {}), ...(isRecord(value.dependencies) ? value.dependencies : {}) }
  const matches: FrameworkId[] = []
  if ('next' in dependencies || '@holo-js/adapter-next' in dependencies) matches.push('next')
  if ('nuxt' in dependencies || '@holo-js/adapter-nuxt' in dependencies) matches.push('nuxt')
  if ('@sveltejs/kit' in dependencies || '@holo-js/adapter-sveltekit' in dependencies) matches.push('sveltekit')
  if (matches.length > 1) throw new Error(`[Holo Panels] Multiple frameworks detected: ${matches.join(', ')}.`)
  return matches[0]
}

async function detectFramework(projectRoot: string, project?: GeneratorProject): Promise<FrameworkId> {
  if (project?.framework) return project.framework
  const descriptor = await optionalContents(projectPath(projectRoot, '.holo-js/framework/project.json'))
  if (descriptor) {
    const parsed = JSON.parse(descriptor) as unknown
    const framework = isRecord(parsed) ? parsed.framework : undefined
    if (framework === 'next' || framework === 'nuxt' || framework === 'sveltekit') return framework
    throw new Error('[Holo Panels] Invalid Holo framework descriptor.')
  }
  const manifest = JSON.parse(await readFile(projectPath(projectRoot, 'package.json'), 'utf8')) as unknown
  const framework = frameworkFromManifest(manifest)
  if (!framework) throw new Error('[Holo Panels] Cannot detect Next.js, Nuxt, or SvelteKit.')
  return framework
}

type HoloRegistryModel = {
  readonly exportName?: string
  readonly name: string
  readonly sourcePath: string
  readonly tableName: string
}

function parseHoloRegistryModel(value: unknown): HoloRegistryModel | undefined {
  if (!isRecord(value)
    || typeof value.name !== 'string'
    || typeof value.sourcePath !== 'string'
    || typeof value.tableName !== 'string'
    || (typeof value.exportName !== 'undefined' && typeof value.exportName !== 'string')) return undefined
  return value as HoloRegistryModel
}

function tableBlock(schema: string, table: string): string {
  const marker = `defineGeneratedTable(${JSON.stringify(table)}, {`
  const start = schema.indexOf(marker)
  if (start < 0) throw new Error(`[Holo Panels] Holo table metadata is missing for ${table}. Run holo prepare.`)
  const bodyStart = start + marker.length
  let depth = 1
  let quoted = false
  let escaped = false
  for (let index = bodyStart; index < schema.length; index += 1) {
    const character = schema[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return schema.slice(bodyStart, index)
    }
  }
  throw new Error(`[Holo Panels] Holo table metadata is malformed for ${table}. Run holo prepare.`)
}

function fieldType(columnType: string): string {
  if (columnType === 'boolean') return 'boolean'
  if (['date', 'dateTime', 'timestamp', 'timestampTz'].includes(columnType)) return 'datetime'
  if (['bigInteger', 'decimal', 'double', 'float', 'id', 'integer', 'mediumInteger', 'smallInteger', 'tinyInteger'].includes(columnType)) return 'number'
  return 'string'
}

function parseTableFields(schema: string, table: string): readonly ModelMetadata['fields'][number][] {
  const fields: ModelMetadata['fields'][number][] = []
  const pattern = /^\s*"([A-Za-z_$][A-Za-z0-9_$]*)":\s*column\.([A-Za-z][A-Za-z0-9]*)\([^\n]*$/gm
  for (const match of tableBlock(schema, table).matchAll(pattern)) {
    fields.push(Object.freeze({
      name: match[1]!,
      type: fieldType(match[2]!),
      ...(match[0].includes('.nullable()') ? { nullable: true } : {}),
    }))
  }
  if (fields.length === 0) throw new Error(`[Holo Panels] Holo table metadata has no columns for ${table}. Run holo prepare.`)
  return Object.freeze(fields)
}

function parseModelRelations(source: string): readonly ModelRelationMetadata[] {
  const relations: ModelRelationMetadata[] = []
  const pattern = /^\s*([A-Za-z_$][A-Za-z0-9_$]*):\s*(belongsTo|belongsToMany|hasMany|hasOne)\(\s*(?:\(\)\s*=>\s*)?(?:['"])?([A-Z][A-Za-z0-9]*)(?:['"])?/gm
  for (const match of source.matchAll(pattern)) {
    const rawKind = match[2]!
    relations.push(Object.freeze({
      name: match[1]!,
      target: match[3]!,
      kind: rawKind === 'belongsToMany' ? 'manyToMany' : rawKind as 'belongsTo' | 'hasMany' | 'hasOne',
    }))
  }
  return Object.freeze(relations)
}

async function loadHoloModelMetadata(request: GeneratorRequest, name: string): Promise<readonly ModelMetadata[]> {
  const registryPath = projectPath(request.projectRoot, '.holo-js/generated/registry.json')
  await assertSafePath(request.projectRoot, registryPath)
  const registryContents = await optionalContents(registryPath)
  if (!registryContents) return []
  const registry = JSON.parse(registryContents) as unknown
  if (!isRecord(registry) || registry.version !== 1 || !Array.isArray(registry.models)) {
    throw new Error('[Holo Panels] Invalid Holo generated project registry. Run holo prepare.')
  }
  const entries = registry.models.map(parseHoloRegistryModel).filter((entry): entry is HoloRegistryModel => typeof entry !== 'undefined')
    .filter(entry => entry.name.toLowerCase() === name.toLowerCase())
  if (entries.length === 0) return []
  const generatedSchemaPath = request.project?.config?.paths?.generatedSchema
    ?? (isRecord(registry.paths) && typeof registry.paths.generatedSchema === 'string' ? registry.paths.generatedSchema : undefined)
    ?? '.holo-js/generated/schema.generated.ts'
  const schemaPath = projectPath(request.projectRoot, generatedSchemaPath)
  await assertSafePath(request.projectRoot, schemaPath)
  const schema = await readFile(schemaPath, 'utf8')
  return await Promise.all(entries.map(async entry => {
    const sourcePath = projectPath(request.projectRoot, entry.sourcePath)
    await assertSafePath(request.projectRoot, sourcePath)
    const source = await readFile(sourcePath, 'utf8')
    return Object.freeze({
      name: entry.name,
      ...(entry.exportName ? { exportName: entry.exportName } : {}),
      importPath: `~/${entry.sourcePath.replace(/\.(?:[cm]?[jt]sx?)$/, '')}`,
      fields: parseTableFields(schema, entry.tableName),
      relations: parseModelRelations(source),
      table: entry.tableName,
    })
  }))
}

async function modelMetadata(request: GeneratorRequest, name: string): Promise<ModelMetadata | undefined> {
  if (!booleanFlag(request, 'generate')) return undefined
  const injected = (request.project?.models ?? []).filter(model => model.name.toLowerCase() === name.toLowerCase())
  const matches = injected.length > 0 ? injected : await loadHoloModelMetadata(request, name)
  if (matches.length !== 1) {
    throw new Error(`[Holo Panels] ${matches.length === 0 ? `No Holo model metadata found for ${name}` : `Ambiguous Holo model metadata for ${name}`}.`)
  }
  const model = matches[0]!
  assertDefinitionName(model.name)
  if (model.exportName && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(model.exportName)) {
    throw new Error(`[Holo Panels] Model ${model.name} has an invalid export name.`)
  }
  if (!model.importPath
    || isAbsolute(model.importPath)
    || !/^[A-Za-z0-9@~._/-]+$/.test(model.importPath)
    || model.importPath.split('/').includes('..')) {
    throw new Error(`[Holo Panels] Model ${model.name} has an invalid import path.`)
  }
  if (model.table && !/^[A-Za-z][A-Za-z0-9_]*$/.test(model.table)) {
    throw new Error(`[Holo Panels] Model ${model.name} has invalid table metadata.`)
  }
  const seen = new Set<string>()
  for (const field of model.fields) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field.name) || seen.has(field.name)) {
      throw new Error(`[Holo Panels] Model ${model.name} has invalid or duplicate field metadata.`)
    }
    seen.add(field.name)
  }
  const relationNames = new Set<string>()
  for (const relation of model.relations ?? []) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(relation.name)
      || relationNames.has(relation.name)
      || !/^[A-Z][A-Za-z0-9]*$/.test(relation.target)
      || !['belongsTo', 'hasMany', 'hasOne', 'manyToMany'].includes(relation.kind)) {
      throw new Error(`[Holo Panels] Model ${model.name} has invalid or duplicate relation metadata.`)
    }
    relationNames.add(relation.name)
  }
  return model
}

async function createFiles(request: GeneratorRequest): Promise<readonly GeneratedFile[]> {
  const panel = request.kind === 'panel' ? assertPanelId(request.args[0]) : assertPanelId(flag(request, 'panel') ?? await detectPanel(request.projectRoot))
  const name = request.kind === 'panel'
    ? panel.split('-').map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join('')
    : assertDefinitionName(request.args[0])
  const resourceRequired = ['exporter', 'importer', 'resource-page', 'relation-manager'].includes(request.kind)
  const resourceFlag = flag(request, 'resource')
  if (resourceRequired && !resourceFlag) throw new Error(`[Holo Panels] make:${request.kind} requires --resource <Resource>.`)
  const resource = resourceRequired
    ? assertDefinitionName(resourceFlag)
    : undefined
  const framework = ['form-field', 'infolist-entry', 'table-column'].includes(request.kind)
    ? await detectFramework(request.projectRoot, request.project)
    : undefined
  const split = booleanFlag(request, 'split')
  if (split && request.kind !== 'resource') throw new Error('[Holo Panels] --split is supported only by make:resource.')
  return renderTemplates(request.kind, {
    framework,
    guard: assertGuard(flag(request, 'guard') ?? panel),
    isDefault: booleanFlag(request, 'default'),
    model: request.kind === 'resource' ? await modelMetadata(request, name) : undefined,
    name,
    panel,
    panelPath: assertPanelPath(flag(request, 'path'), panel),
    resource,
    simple: booleanFlag(request, 'simple'),
    split,
  })
}

export async function generate(request: GeneratorRequest, options: GenerateOptions): Promise<readonly string[]> {
  const root = resolve(request.projectRoot)
  const files = await createFiles({ ...request, projectRoot: root })
  const forces = forceTargets(request)
  const targets = new Set(files.map(file => file.path))
  const irrelevantForce = [...forces].find(target => !targets.has(target))
  if (irrelevantForce) throw new Error(`[Holo Panels] --force target is not generated by this command: ${irrelevantForce}.`)

  const states = await Promise.all(files.map(async (file) => {
    const absolutePath = projectPath(root, file.path)
    await assertSafePath(root, absolutePath)
    const existing = await optionalContents(absolutePath)
    if (typeof existing !== 'undefined' && !forces.has(file.path)) {
      throw new Error(`[Holo Panels] Refusing to overwrite ${file.path}. Re-run with --force ${file.path} to replace that exact file.`)
    }
    return { ...file, absolutePath, existed: typeof existing !== 'undefined' }
  }))

  const created: string[] = []
  try {
    for (const state of states) {
      await atomicWrite(root, state.absolutePath, state.contents, state.existed)
      if (!state.existed) created.push(state.absolutePath)
    }
    await options.prepare()
    return Object.freeze(files.map(file => file.path))
  } catch (error) {
    await Promise.all(created.map(async path => {
      await assertSafePath(root, path)
      await rm(path, { force: true })
    }))
    throw error
  }
}
