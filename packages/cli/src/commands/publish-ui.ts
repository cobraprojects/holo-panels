import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  lstat,
  link,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, posix, relative, resolve, sep } from 'node:path'
import type { GeneratorCommand, GeneratorCommandContext } from './generators'

const CLI_PACKAGE = '@holo-js/panels-cli'
const PUBLICATION_MANIFEST = '.holo-js/panels/published-ui.json'
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_SOURCE_BYTES = 32 * 1024 * 1024
const CHECKSUM = /^[a-f0-9]{64}$/u
const FRAMEWORKS = Object.freeze({
  next: 'resources/panels/ui/next',
  nuxt: 'resources/panels/ui/nuxt',
  sveltekit: 'resources/panels/ui/sveltekit',
})

type FrameworkId = keyof typeof FRAMEWORKS

type PackageFile = {
  readonly path: string
  readonly checksum: string
  readonly bytes: Uint8Array
  readonly text: string
}

type PackageSource = {
  readonly framework: FrameworkId
  readonly files: readonly PackageFile[]
  readonly packageVersion: string
}

type PublicationFile = {
  readonly path: string
  readonly publishedChecksum: string
}

type PublicationManifest = {
  readonly version: 1
  readonly framework: FrameworkId
  readonly source: {
    readonly package: typeof CLI_PACKAGE
    readonly version: string
  }
  readonly destination: string
  readonly files: readonly PublicationFile[]
}

type LocalFile = PublicationFile & {
  readonly bytes: Uint8Array
  readonly text: string
}

type Change = {
  readonly kind: 'add' | 'change' | 'delete'
  readonly path: string
  readonly previous?: LocalFile
  readonly incoming?: PackageFile
}

type DiffLine = {
  readonly kind: 'context' | 'add' | 'delete'
  readonly text: string
}

type Snapshot = {
  readonly path: string
  readonly bytes?: Uint8Array
}

type PublishUiTestHooks = {
  afterMutation?(kind: Change['kind'] | 'manifest', path: string): void | Promise<void>
  beforeMutation?(kind: Change['kind'] | 'manifest', path: string): void | Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function isExactVersion(value: string): boolean {
  const number = '(?:0|[1-9]\\d*)'
  const identifier = '(?:0|[1-9]\\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)'
  const buildIdentifier = '[0-9A-Za-z-]+'
  return new RegExp(`^${number}\\.${number}\\.${number}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+${buildIdentifier}(?:\\.${buildIdentifier})*)?$`).test(value)
}

function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index])
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function safeRelativePath(value: string): boolean {
  if (!value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || posix.normalize(value) !== value) return false
  return value.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

function decodeText(bytes: Uint8Array, path: string): string {
  if (bytes.includes(0)) throw new Error(`[Holo Panels] Packaged UI source contains a NUL byte: ${path}.`)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`[Holo Panels] Packaged UI source is not valid UTF-8: ${path}.`)
  }
}

function parseJson(contents: string, path: string): unknown {
  try {
    return JSON.parse(contents) as unknown
  } catch {
    throw new Error(`[Holo Panels] Invalid JSON at ${path}.`)
  }
}

function resolveBelow(root: string, path: string): string {
  if (!safeRelativePath(path)) throw new Error(`[Holo Panels] Unsafe UI publication path: ${path}.`)
  const target = resolve(root, ...path.split('/'))
  const fromRoot = relative(resolve(root), target)
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`[Holo Panels] UI publication path escapes its root: ${path}.`)
  }
  return target
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function assertNoSymlink(root: string, target: string): Promise<void> {
  const resolvedRoot = resolve(root)
  const resolvedTarget = resolve(target)
  const fromRoot = relative(resolvedRoot, resolvedTarget)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw new Error(`[Holo Panels] Path escapes its trusted root: ${target}.`)
  let current = resolvedRoot
  for (const segment of fromRoot.split(sep).filter(Boolean)) {
    current = join(current, segment)
    try {
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink()) throw new Error(`[Holo Panels] Refusing symbolic link: ${relative(resolvedRoot, current) || '.'}.`)
    } catch (error) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw error
    }
  }
}

async function regularFile(root: string, path: string, label: string): Promise<Uint8Array> {
  await assertNoSymlink(root, path)
  const metadata = await lstat(path)
  if (!metadata.isFile()) throw new Error(`[Holo Panels] ${label} is not a regular file: ${relative(root, path)}.`)
  return new Uint8Array(await readFile(path))
}

async function ownPackage(packageRoot?: string): Promise<{ readonly root: string, readonly version: string }> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  const candidates = packageRoot ? [resolve(packageRoot)] : [resolve(moduleDirectory, '..'), resolve(moduleDirectory, '../..')]
  for (const root of candidates) {
    const packagePath = join(root, 'package.json')
    if (!await pathExists(packagePath)) continue
    await assertNoSymlink(root, packagePath)
    const value = parseJson(await readFile(packagePath, 'utf8'), packagePath)
    if (isRecord(value) && value.name === CLI_PACKAGE && typeof value.version === 'string' && isExactVersion(value.version)) {
      return { root, version: value.version }
    }
  }
  throw new Error(`[Holo Panels] Installed ${CLI_PACKAGE} package manifest has an invalid name or version.`)
}

async function sourceTreeFiles(root: string, directory = root): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries.sort((left, right) => comparePaths(left.name, right.name))) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`[Holo Panels] Packaged UI source contains a symbolic link: ${relative(root, path)}.`)
    if (entry.isDirectory()) paths.push(...await sourceTreeFiles(root, path))
    else if (entry.isFile()) paths.push(relative(root, path).split(sep).join('/'))
    else throw new Error(`[Holo Panels] Packaged UI source contains a special file: ${relative(root, path)}.`)
  }
  return paths.sort(comparePaths)
}

async function appConfiguration(projectRoot: string, manifestPath?: string): Promise<Uint8Array> {
  const candidates = manifestPath
    ? [resolve(projectRoot, manifestPath)]
    : ['config/app.ts', 'config/app.mts', 'config/app.js', 'config/app.mjs'].map(path => join(projectRoot, path))
  for (const path of candidates) {
    await assertNoSymlink(projectRoot, path)
    const bytes = await readOptional(path)
    if (bytes) return bytes
  }
  throw new Error('[Holo Panels] Missing config/app.(ts|mts|js|mjs). Activate @holo-js/panels before publishing UI.')
}

function parsePackageEntries(value: unknown, framework: FrameworkId, path: string): readonly { readonly path: string, readonly checksum: string }[] {
  if (!isRecord(value) || !exactKeys(value, ['version', 'framework', 'files']) || value.version !== 1 || value.framework !== framework || !Array.isArray(value.files) || value.files.length === 0) {
    throw new Error(`[Holo Panels] Invalid packaged UI manifest at ${path}.`)
  }
  const entries = value.files.map((entry): { readonly path: string, readonly checksum: string } => {
    if (!isRecord(entry) || !exactKeys(entry, ['path', 'checksum']) || typeof entry.path !== 'string' || !safeRelativePath(entry.path) || typeof entry.checksum !== 'string' || !CHECKSUM.test(entry.checksum)) {
      throw new Error(`[Holo Panels] Invalid packaged UI file entry at ${path}.`)
    }
    return { path: entry.path, checksum: entry.checksum }
  })
  const sorted = [...entries].sort((left, right) => comparePaths(left.path, right.path))
  if (entries.some((entry, index) => entry.path !== sorted[index]?.path) || new Set(entries.map(entry => entry.path)).size !== entries.length) {
    throw new Error(`[Holo Panels] Packaged UI manifest files must be sorted and unique at ${path}.`)
  }
  return entries
}

async function loadPackageSource(framework: FrameworkId, packageRoot?: string): Promise<PackageSource> {
  const own = await ownPackage(packageRoot)
  const frameworkRoot = resolve(own.root, 'publish', framework)
  const sourceRoot = join(frameworkRoot, 'src')
  const manifestPath = join(frameworkRoot, 'manifest.json')
  await assertNoSymlink(own.root, manifestPath)
  await assertNoSymlink(own.root, sourceRoot)
  const manifest = parseJson(await readFile(manifestPath, 'utf8'), manifestPath)
  const entries = parsePackageEntries(manifest, framework, manifestPath)
  const discovered = await sourceTreeFiles(sourceRoot)
  if (discovered.length !== entries.length || discovered.some((path, index) => path !== entries[index]?.path)) {
    throw new Error(`[Holo Panels] Packaged UI manifest does not exactly cover ${framework}/src.`)
  }
  let totalBytes = 0
  const files: PackageFile[] = []
  for (const entry of entries) {
    const sourcePath = resolveBelow(sourceRoot, entry.path)
    const bytes = await regularFile(sourceRoot, sourcePath, 'Packaged UI source')
    totalBytes += bytes.byteLength
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`[Holo Panels] Packaged UI source exceeds 2 MiB: ${entry.path}.`)
    if (totalBytes > MAX_SOURCE_BYTES) throw new Error('[Holo Panels] Packaged UI source exceeds 32 MiB in total.')
    if (checksum(bytes) !== entry.checksum) throw new Error(`[Holo Panels] Packaged UI checksum mismatch: ${entry.path}.`)
    files.push({ ...entry, bytes, text: decodeText(bytes, entry.path) })
  }
  return { framework, files: Object.freeze(files), packageVersion: own.version }
}

function parsePublication(contents: string, framework: FrameworkId, path: string): PublicationManifest {
  const value = parseJson(contents, path)
  const destination = FRAMEWORKS[framework]
  if (!isRecord(value) || !exactKeys(value, ['version', 'framework', 'source', 'destination', 'files']) || value.version !== 1 || value.framework !== framework || value.destination !== destination || !isRecord(value.source) || !exactKeys(value.source, ['package', 'version']) || value.source.package !== CLI_PACKAGE || typeof value.source.version !== 'string' || !isExactVersion(value.source.version) || !Array.isArray(value.files)) {
    throw new Error(`[Holo Panels] Invalid publication manifest at ${PUBLICATION_MANIFEST}.`)
  }
  const files = value.files.map((entry): PublicationFile => {
    if (!isRecord(entry) || !exactKeys(entry, ['path', 'publishedChecksum']) || typeof entry.path !== 'string' || !safeRelativePath(entry.path) || typeof entry.publishedChecksum !== 'string' || !CHECKSUM.test(entry.publishedChecksum)) {
      throw new Error(`[Holo Panels] Invalid publication file entry at ${PUBLICATION_MANIFEST}.`)
    }
    return { path: entry.path, publishedChecksum: entry.publishedChecksum }
  })
  const sorted = [...files].sort((left, right) => comparePaths(left.path, right.path))
  if (files.some((entry, index) => entry.path !== sorted[index]?.path) || new Set(files.map(entry => entry.path)).size !== files.length) {
    throw new Error(`[Holo Panels] Publication manifest files must be sorted and unique at ${PUBLICATION_MANIFEST}.`)
  }
  return { version: 1, framework, source: { package: CLI_PACKAGE, version: value.source.version }, destination, files }
}

async function readOptional(path: string): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(await readFile(path))
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

async function detectFramework(projectRoot: string): Promise<FrameworkId> {
  const descriptorPath = join(projectRoot, '.holo-js/framework/project.json')
  await assertNoSymlink(projectRoot, descriptorPath)
  const descriptor = await readOptional(descriptorPath)
  const packagePath = join(projectRoot, 'package.json')
  await assertNoSymlink(projectRoot, packagePath)
  const manifest = parseJson(await readFile(packagePath, 'utf8'), 'package.json')
  if (!isRecord(manifest)) throw new Error('[Holo Panels] package.json must contain an object.')
  const dependencies = {
    ...(isRecord(manifest.devDependencies) ? manifest.devDependencies : {}),
    ...(isRecord(manifest.dependencies) ? manifest.dependencies : {}),
  }
  const detected = (Object.keys(FRAMEWORKS) as FrameworkId[]).filter(framework => {
    if (framework === 'next') return 'next' in dependencies || '@holo-js/adapter-next' in dependencies
    if (framework === 'nuxt') return 'nuxt' in dependencies || '@holo-js/adapter-nuxt' in dependencies
    return '@sveltejs/kit' in dependencies || '@holo-js/adapter-sveltekit' in dependencies
  })
  if (detected.length > 1) throw new Error(`[Holo Panels] Multiple frameworks detected: ${detected.join(', ')}.`)
  if (descriptor) {
    const value = parseJson(new TextDecoder().decode(descriptor), '.holo-js/framework/project.json')
    const framework = isRecord(value) ? value.framework : undefined
    if (framework !== 'next' && framework !== 'nuxt' && framework !== 'sveltekit') throw new Error('[Holo Panels] Invalid framework descriptor.')
    if (detected.length === 1 && detected[0] !== framework) throw new Error(`[Holo Panels] Framework descriptor ${framework} conflicts with detected ${detected[0]} dependency.`)
    return framework
  }
  if (detected.length !== 1) throw new Error('[Holo Panels] Cannot detect Next.js, Nuxt, or SvelteKit from project dependencies.')
  return detected[0]!
}

async function atomicWrite(root: string, path: string, bytes: Uint8Array, create: boolean): Promise<void> {
  await assertNoSymlink(root, path)
  await mkdir(dirname(path), { recursive: true })
  await assertNoSymlink(root, path)
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, bytes, { flag: 'wx' })
    if (create) await link(temporary, path)
    else await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

function publicationBytes(source: PackageSource): Uint8Array {
  const manifest: PublicationManifest = {
    version: 1,
    framework: source.framework,
    source: { package: CLI_PACKAGE, version: source.packageVersion },
    destination: FRAMEWORKS[source.framework],
    files: source.files.map(file => ({ path: file.path, publishedChecksum: file.checksum })),
  }
  return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
}

async function localFiles(projectRoot: string, manifest: PublicationManifest): Promise<{ readonly files: readonly LocalFile[], readonly conflicts: readonly string[] }> {
  const destination = join(projectRoot, ...manifest.destination.split('/'))
  const files: LocalFile[] = []
  const conflicts: string[] = []
  for (const entry of manifest.files) {
    const path = resolveBelow(destination, entry.path)
    try {
      const bytes = await regularFile(projectRoot, path, 'Published UI path')
      if (checksum(bytes) !== entry.publishedChecksum) conflicts.push(`${manifest.destination}/${entry.path}: locally modified`)
      else files.push({ ...entry, bytes, text: new TextDecoder().decode(bytes) })
    } catch (error) {
      conflicts.push(`${manifest.destination}/${entry.path}: ${error instanceof Error && error.message.includes('symbolic link') ? 'symbolic link' : 'missing or changed type'}`)
    }
  }
  return { files, conflicts }
}

async function changesFor(projectRoot: string, source: PackageSource, manifest: PublicationManifest, local: readonly LocalFile[]): Promise<{ readonly changes: readonly Change[], readonly conflicts: readonly string[] }> {
  const destination = join(projectRoot, ...manifest.destination.split('/'))
  const previous = new Map(local.map(file => [file.path, file]))
  const incoming = new Map(source.files.map(file => [file.path, file]))
  const changes: Change[] = []
  const conflicts: string[] = []
  for (const path of [...new Set([...previous.keys(), ...incoming.keys()])].sort(comparePaths)) {
    const oldFile = previous.get(path)
    const newFile = incoming.get(path)
    if (!oldFile && newFile) {
      const target = resolveBelow(destination, path)
      await assertNoSymlink(projectRoot, target)
      if (await pathExists(target)) conflicts.push(`${manifest.destination}/${path}: unmanaged addition collision`)
      else changes.push({ kind: 'add', path, incoming: newFile })
    } else if (oldFile && !newFile) changes.push({ kind: 'delete', path, previous: oldFile })
    else if (oldFile && newFile && oldFile.publishedChecksum !== newFile.checksum) changes.push({ kind: 'change', path, previous: oldFile, incoming: newFile })
  }
  return { changes, conflicts }
}

function diffLines(text: string): readonly string[] {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function changedLines(previous: readonly string[], incoming: readonly string[]): readonly DiffLine[] {
  const maximum = previous.length + incoming.length
  const frontier = new Map<number, number>([[1, 0]])
  const trace: Map<number, number>[] = []
  let distance = 0
  for (; distance <= maximum; distance += 1) {
    trace.push(new Map(frontier))
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const insertion = diagonal === -distance || diagonal !== distance && (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1)
      let oldIndex = insertion ? frontier.get(diagonal + 1) ?? 0 : (frontier.get(diagonal - 1) ?? 0) + 1
      let newIndex = oldIndex - diagonal
      while (oldIndex < previous.length && newIndex < incoming.length && previous[oldIndex] === incoming[newIndex]) {
        oldIndex += 1
        newIndex += 1
      }
      frontier.set(diagonal, oldIndex)
      if (oldIndex >= previous.length && newIndex >= incoming.length) {
        const lines: DiffLine[] = []
        let oldCursor = previous.length
        let newCursor = incoming.length
        for (let step = distance; step >= 0; step -= 1) {
          const state = trace[step]!
          const currentDiagonal = oldCursor - newCursor
          const previousDiagonal = currentDiagonal === -step || currentDiagonal !== step && (state.get(currentDiagonal - 1) ?? -1) < (state.get(currentDiagonal + 1) ?? -1)
            ? currentDiagonal + 1
            : currentDiagonal - 1
          const previousOld = state.get(previousDiagonal) ?? 0
          const previousNew = previousOld - previousDiagonal
          while (oldCursor > previousOld && newCursor > previousNew) {
            lines.push({ kind: 'context', text: previous[oldCursor - 1]! })
            oldCursor -= 1
            newCursor -= 1
          }
          if (step === 0) break
          if (oldCursor === previousOld) {
            lines.push({ kind: 'add', text: incoming[newCursor - 1]! })
            newCursor -= 1
          } else {
            lines.push({ kind: 'delete', text: previous[oldCursor - 1]! })
            oldCursor -= 1
          }
        }
        return lines.reverse()
      }
    }
  }
  return []
}

function diffHunks(lines: readonly DiffLine[]): readonly { readonly start: number, readonly end: number }[] {
  const changed = lines.flatMap((line, index) => line.kind === 'context' ? [] : [index])
  if (changed.length === 0) return []
  const hunks: { start: number, end: number }[] = []
  let start = Math.max(0, changed[0]! - 3)
  let end = Math.min(lines.length, changed[0]! + 4)
  for (const index of changed.slice(1)) {
    const nextStart = Math.max(0, index - 3)
    const nextEnd = Math.min(lines.length, index + 4)
    if (nextStart <= end) end = Math.max(end, nextEnd)
    else {
      hunks.push({ start, end })
      start = nextStart
      end = nextEnd
    }
  }
  hunks.push({ start, end })
  return hunks
}

function hunkHeader(lines: readonly DiffLine[], start: number, end: number): string {
  let oldStart = 1
  let newStart = 1
  for (const line of lines.slice(0, start)) {
    if (line.kind !== 'add') oldStart += 1
    if (line.kind !== 'delete') newStart += 1
  }
  const hunk = lines.slice(start, end)
  const oldCount = hunk.filter(line => line.kind !== 'add').length
  const newCount = hunk.filter(line => line.kind !== 'delete').length
  return `@@ -${oldCount === 0 ? oldStart - 1 : oldStart},${oldCount} +${newCount === 0 ? newStart - 1 : newStart},${newCount} @@`
}

function unifiedDiff(change: Change, destination: string): string {
  const oldLines = change.previous ? diffLines(change.previous.text) : []
  const newLines = change.incoming ? diffLines(change.incoming.text) : []
  const lines = changedLines(oldLines, newLines)
  const oldPath = change.kind === 'add' ? '/dev/null' : `a/${destination}/${change.path}`
  const newPath = change.kind === 'delete' ? '/dev/null' : `b/${destination}/${change.path}`
  return [`--- ${oldPath}`, `+++ ${newPath}`, ...diffHunks(lines).flatMap(({ start, end }) => [
    hunkHeader(lines, start, end),
    ...lines.slice(start, end).map(line => `${line.kind === 'context' ? ' ' : line.kind === 'add' ? '+' : '-'}${line.text}`),
  ])].join('\n')
}

async function rollback(projectRoot: string, snapshots: readonly Snapshot[], originalError: unknown): Promise<never> {
  const recoveryErrors: string[] = []
  for (const snapshot of [...snapshots].reverse()) {
    try {
      await assertNoSymlink(projectRoot, snapshot.path)
      if (snapshot.bytes) await atomicWrite(projectRoot, snapshot.path, snapshot.bytes, false)
      else await rm(snapshot.path, { force: true })
    } catch (error) {
      recoveryErrors.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (recoveryErrors.length) {
    throw new Error(`[Holo Panels] Synchronization failed and rollback failed: ${recoveryErrors.join('; ')}. Original error: ${originalError instanceof Error ? originalError.message : String(originalError)}`)
  }
  throw originalError
}

async function removeEmptyParents(path: string, boundary: string): Promise<void> {
  let current = dirname(path)
  while (current !== boundary) {
    try {
      await rm(current)
      current = dirname(current)
    } catch (error) {
      if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTEMPTY' || error.code === 'EEXIST')) return
      throw error
    }
  }
}

async function applyChanges(projectRoot: string, source: PackageSource, changes: readonly Change[], manifestPath: string, oldManifest?: Uint8Array, hooks?: PublishUiTestHooks): Promise<void> {
  const destination = join(projectRoot, ...FRAMEWORKS[source.framework].split('/'))
  const snapshots = new Map(changes.map(change => {
    const path = resolveBelow(destination, change.path)
    return [path, { path, ...(change.previous ? { bytes: change.previous.bytes } : {}) }]
  }))
  const touched: Snapshot[] = []
  try {
    for (const change of changes) {
      const path = resolveBelow(destination, change.path)
      await assertNoSymlink(projectRoot, path)
      if (change.previous) {
        const current = await regularFile(projectRoot, path, 'Published UI path')
        if (!equalBytes(current, change.previous.bytes)) throw new Error(`[Holo Panels] Published UI changed during synchronization: ${change.path}.`)
      }
      await hooks?.beforeMutation?.(change.kind, path)
      touched.push(snapshots.get(path)!)
      if (change.kind === 'delete') await rm(path)
      else await atomicWrite(projectRoot, path, change.incoming!.bytes, change.kind === 'add')
      await hooks?.afterMutation?.(change.kind, path)
    }
    if (oldManifest) {
      const currentManifest = await regularFile(projectRoot, manifestPath, 'Publication manifest')
      if (!equalBytes(currentManifest, oldManifest)) throw new Error('[Holo Panels] Publication manifest changed during synchronization.')
    }
    await hooks?.beforeMutation?.('manifest', manifestPath)
    touched.push({ path: manifestPath, ...(oldManifest ? { bytes: oldManifest } : {}) })
    await atomicWrite(projectRoot, manifestPath, publicationBytes(source), !oldManifest)
    await hooks?.afterMutation?.('manifest', manifestPath)
    await Promise.all(changes.filter(change => change.kind === 'delete').map(change => removeEmptyParents(resolveBelow(destination, change.path), destination)))
  } catch (error) {
    await rollback(projectRoot, touched, error)
  }
}

function validateArguments(context: GeneratorCommandContext): boolean {
  if (context.args.length !== 0) throw new Error('[Holo Panels] panels:publish-ui does not accept positional arguments.')
  const keys = Object.keys(context.flags)
  if (keys.some(key => key !== 'confirm')) throw new Error('[Holo Panels] panels:publish-ui accepts only --confirm.')
  if ('confirm' in context.flags && context.flags.confirm !== true) throw new Error('[Holo Panels] --confirm must be a boolean flag without a value.')
  return context.flags.confirm === true
}

export async function publishUi(context: GeneratorCommandContext, packageRoot?: string, hooks?: PublishUiTestHooks): Promise<void> {
  const confirmed = validateArguments(context)
  const projectRoot = resolve(context.projectRoot)
  const project = await context.loadProject()
  const appConfig = await appConfiguration(projectRoot, project.manifestPath)
  const appConfigText = new TextDecoder().decode(appConfig)
  const pluginBlocks = [...appConfigText.matchAll(/(?:^|[\n,{])\s*(?:"plugins"|plugins):\s*\[([\s\S]*?)\]/gu)]
  const pluginNames = pluginBlocks.flatMap(match => [...(match[1] ?? '').matchAll(/(['"])(.*?)\1/gu)]).map(match => match[2]?.trim())
  if (pluginBlocks.length !== 1 || pluginNames.filter(name => name === '@holo-js/panels').length !== 1) {
    throw new Error('[Holo Panels] @holo-js/panels must be activated exactly once before publishing UI.')
  }
  const framework = await detectFramework(projectRoot)
  const source = await loadPackageSource(framework, packageRoot)
  const manifestPath = join(projectRoot, ...PUBLICATION_MANIFEST.split('/'))
  await assertNoSymlink(projectRoot, manifestPath)
  const oldManifestBytes = await readOptional(manifestPath)
  if (!oldManifestBytes) {
    const destination = join(projectRoot, ...FRAMEWORKS[framework].split('/'))
    const collisions: string[] = []
    for (const file of source.files) {
      const path = resolveBelow(destination, file.path)
      await assertNoSymlink(projectRoot, path)
      if (await pathExists(path)) collisions.push(`${FRAMEWORKS[framework]}/${file.path}: unmanaged destination file`)
    }
    if (collisions.length) throw new Error(`[Holo Panels] Cannot publish UI:\n${collisions.join('\n')}`)
    const additions = source.files.map((incoming): Change => ({ kind: 'add', path: incoming.path, incoming }))
    await applyChanges(projectRoot, source, additions, manifestPath, undefined, hooks)
    process.stdout.write(`[Holo Panels] Published editable ${framework} UI to ${FRAMEWORKS[framework]}.\n`)
    return
  }

  const oldManifestText = decodeText(oldManifestBytes, PUBLICATION_MANIFEST)
  const manifest = parsePublication(oldManifestText, framework, PUBLICATION_MANIFEST)
  const local = await localFiles(projectRoot, manifest)
  const planned = await changesFor(projectRoot, source, manifest, local.files)
  const conflicts = [...local.conflicts, ...planned.conflicts].sort()
  if (conflicts.length) throw new Error(`[Holo Panels] Cannot synchronize published UI:\n${conflicts.join('\n')}`)
  if (planned.changes.length === 0) {
    process.stdout.write('[Holo Panels] Published UI is current; no changes.\n')
    return
  }
  process.stdout.write(`${planned.changes.map(change => unifiedDiff(change, manifest.destination)).join('\n')}\n`)
  if (!confirmed) {
    process.stdout.write('[Holo Panels] Preview only. Re-run holo panels:publish-ui --confirm to apply this exact synchronization after reviewing the diff.\n')
    return
  }
  await applyChanges(projectRoot, source, planned.changes, manifestPath, oldManifestBytes, hooks)
  process.stdout.write('[Holo Panels] Published UI synchronization applied.\n')
}

export const publishUiCommand: GeneratorCommand = Object.freeze({
  name: 'panels:publish-ui',
  description: 'Publish or synchronize editable Holo Panels framework UI.',
  usage: 'holo panels:publish-ui [--confirm]',
  run: publishUi,
})
