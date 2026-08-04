import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

interface ExportConditions {
  readonly [condition: string]: ExportTarget
}

type ExportTarget = ExportConditions | string

interface PackageManifest {
  readonly exports: Readonly<Record<string, ExportTarget>>
  readonly name: string
}

interface PublicEntrypoint {
  readonly declarationPath?: string
  readonly importPath: string
  readonly packageName: string
  readonly subpath: string
  readonly targetPath: string
}

interface PublicSymbol {
  readonly kind: string
  readonly name: string
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(repositoryRoot, 'docs/api-reference.md')
const checkOnly = process.argv.includes('--check')
const buildFirst = process.argv.includes('--build')
const validArguments = new Set(['--build', '--check'])

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const parseExportTarget = (value: unknown, location: string): ExportTarget => {
  if (typeof value === 'string') {
    return value
  }

  if (!isRecord(value)) {
    throw new TypeError(`${location} must be a string or condition object`)
  }

  return Object.fromEntries(
    Object.entries(value).map(([condition, target]) => [
      condition,
      parseExportTarget(target, `${location}.${condition}`),
    ]),
  )
}

const readPackageManifest = (manifestPath: string): PackageManifest => {
  const value: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (!isRecord(value) || typeof value.name !== 'string' || !isRecord(value.exports)) {
    throw new TypeError(`${relative(repositoryRoot, manifestPath)} is missing a name or exports map`)
  }

  return {
    exports: Object.fromEntries(
      Object.entries(value.exports).map(([subpath, target]) => [
        subpath,
        parseExportTarget(target, `${value.name}.exports.${subpath}`),
      ]),
    ),
    name: value.name,
  }
}

const findConditionTarget = (
  target: ExportTarget,
  condition: string,
): string | undefined => {
  if (typeof target === 'string') {
    return undefined
  }

  const directTarget = target[condition]

  if (typeof directTarget === 'string') {
    return directTarget
  }

  for (const nestedTarget of Object.values(target)) {
    const match = findConditionTarget(nestedTarget, condition)

    if (match) {
      return match
    }
  }

  return undefined
}

const findRuntimeTarget = (target: ExportTarget): string => {
  if (typeof target === 'string') {
    return target
  }

  for (const condition of ['import', 'default', 'require']) {
    const match = findConditionTarget(target, condition)

    if (match) {
      return match
    }
  }

  throw new TypeError('Public export has no runtime or asset target')
}

const packageImportPath = (packageName: string, subpath: string): string => (
  subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
)

const discoverEntrypoints = (): readonly PublicEntrypoint[] => {
  const packagesRoot = resolve(repositoryRoot, 'packages')
  const manifestPaths = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(packagesRoot, entry.name, 'package.json'))
    .filter((manifestPath) => {
      try {
        return readPackageManifest(manifestPath).name.startsWith('@holo-js/panels')
      } catch {
        return false
      }
    })

  return manifestPaths.flatMap((manifestPath) => {
    const manifest = readPackageManifest(manifestPath)
    const packageRoot = dirname(manifestPath)

    return Object.entries(manifest.exports).map(([subpath, target]) => {
      const declarationTarget = findConditionTarget(target, 'types')
      const runtimeTarget = findRuntimeTarget(target)

      return {
        declarationPath: declarationTarget
          ? resolve(packageRoot, declarationTarget)
          : undefined,
        importPath: packageImportPath(manifest.name, subpath),
        packageName: manifest.name,
        subpath,
        targetPath: relative(repositoryRoot, resolve(packageRoot, runtimeTarget)),
      }
    })
  }).sort((left, right) => compareText(left.importPath, right.importPath))
}

const resolveSymbol = (checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol => (
  symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
)

const symbolKind = (checker: ts.TypeChecker, exportedSymbol: ts.Symbol): string => {
  const symbol = resolveSymbol(checker, exportedSymbol)
  const kinds: readonly [ts.SymbolFlags, string][] = [
    [ts.SymbolFlags.Class, 'class'],
    [ts.SymbolFlags.Interface, 'interface'],
    [ts.SymbolFlags.TypeAlias, 'type'],
    [ts.SymbolFlags.Enum, 'enum'],
    [ts.SymbolFlags.Function, 'function'],
    [ts.SymbolFlags.Variable, 'constant'],
    [ts.SymbolFlags.Module, 'namespace'],
  ]

  for (const [flag, kind] of kinds) {
    if (symbol.flags & flag) {
      return kind
    }
  }

  return 'export'
}

const collectSymbols = (
  entrypoints: readonly PublicEntrypoint[],
): ReadonlyMap<string, readonly PublicSymbol[]> => {
  const declarationPaths = entrypoints.flatMap((entrypoint) => (
    entrypoint.declarationPath ? [entrypoint.declarationPath] : []
  ))
  const program = ts.createProgram({
    options: {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
      types: [],
    },
    rootNames: declarationPaths,
  })
  const checker = program.getTypeChecker()

  return new Map(declarationPaths.map((declarationPath) => {
    const sourceFile = program.getSourceFile(declarationPath)

    if (!sourceFile) {
      throw new Error(`Missing built declaration ${relative(repositoryRoot, declarationPath)}`)
    }

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile)

    if (!moduleSymbol) {
      throw new Error(`Could not inspect ${relative(repositoryRoot, declarationPath)}`)
    }

    const symbols = checker.getExportsOfModule(moduleSymbol)
      .map((symbol) => ({
        kind: symbolKind(checker, symbol),
        name: symbol.name,
      }))
      .sort((left, right) => compareText(left.name, right.name))

    return [declarationPath, symbols]
  }))
}

const markdownAnchor = (value: string): string => (
  value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
)

const renderReference = (entrypoints: readonly PublicEntrypoint[]): string => {
  const symbolsByDeclaration = collectSymbols(entrypoints)
  const packageNames = [...new Set(entrypoints.map((entrypoint) => entrypoint.packageName))]
  const declarationCount = entrypoints.filter((entrypoint) => entrypoint.declarationPath).length
  const symbolCount = [...symbolsByDeclaration.values()]
    .reduce((total, symbols) => total + symbols.length, 0)
  const lines = [
    '# API reference',
    '',
    '> Generated by `bun scripts/generate-api-reference.ts` from package export maps and built declarations. Do not edit this file manually.',
    '',
    `This index covers ${packageNames.length} published packages, ${entrypoints.length} public subpaths, ${declarationCount} declaration entrypoints, and ${symbolCount} exported symbols. Run \`bun scripts/generate-api-reference.ts --build\` to rebuild packages and regenerate it, or \`bun scripts/generate-api-reference.ts --check\` to verify that it is current.`,
    '',
    'Only import paths listed here are public. A file under `dist` is not public unless a package export map exposes it.',
    '',
    '## Entrypoints',
    '',
    '| Import path | Published target | Declaration | Symbols |',
    '|---|---|---|---:|',
    ...entrypoints.map((entrypoint) => {
      const symbolCountForEntrypoint = entrypoint.declarationPath
        ? symbolsByDeclaration.get(entrypoint.declarationPath)?.length ?? 0
        : 'asset'
      const anchor = markdownAnchor(entrypoint.importPath)

      const declarationTarget = entrypoint.declarationPath
        ? `\`${relative(repositoryRoot, entrypoint.declarationPath)}\``
        : 'none'

      return `| [\`${entrypoint.importPath}\`](#${anchor}) | \`${entrypoint.targetPath}\` | ${declarationTarget} | ${symbolCountForEntrypoint} |`
    }),
    '',
  ]

  for (const packageName of packageNames) {
    lines.push(`## \`${packageName}\``, '')

    for (const entrypoint of entrypoints.filter((candidate) => candidate.packageName === packageName)) {
      lines.push(`<a id="${markdownAnchor(entrypoint.importPath)}"></a>`, '')
      lines.push(`### \`${entrypoint.importPath}\``, '')
      lines.push(`Published target: [\`${entrypoint.targetPath}\`](../${entrypoint.targetPath})`, '')

      if (!entrypoint.declarationPath) {
        const assetKind = entrypoint.targetPath.endsWith('.json') ? 'package metadata' : 'stylesheet asset'
        lines.push(`This subpath exports a ${assetKind} and has no TypeScript symbols.`, '')
        continue
      }

      const declarationTarget = relative(repositoryRoot, entrypoint.declarationPath)

      lines.push(`Declaration source: [\`${declarationTarget}\`](../${declarationTarget})`, '')

      const symbols = symbolsByDeclaration.get(entrypoint.declarationPath)

      if (!symbols || symbols.length === 0) {
        lines.push('This declaration entrypoint currently exports no symbols.', '')
        continue
      }

      lines.push('| Symbol | Kind |', '|---|---|')

      for (const symbol of symbols) {
        lines.push(`| \`${symbol.name}\` | ${symbol.kind} |`)
      }

      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

for (const argument of process.argv.slice(2)) {
  if (!validArguments.has(argument)) {
    throw new TypeError(`Unknown argument: ${argument}`)
  }
}

if (buildFirst) {
  execFileSync('bun', ['run', 'build'], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  })
}

const reference = renderReference(discoverEntrypoints())

if (checkOnly) {
  const currentReference = readFileSync(outputPath, 'utf8')

  if (currentReference !== reference) {
    process.stderr.write('docs/api-reference.md is stale; run bun scripts/generate-api-reference.ts\n')
    process.exitCode = 1
  } else {
    process.stdout.write('docs/api-reference.md matches all public exports and built declarations\n')
  }
} else {
  writeFileSync(outputPath, reference)
  process.stdout.write('Generated docs/api-reference.md\n')
}
