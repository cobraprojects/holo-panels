import { readFile, readdir } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import ts from 'typescript'

const packagesRoot = new URL('../packages/', import.meta.url)
const sourceExtensions = ['.css', '.js', '.jsx', '.mjs', '.mts', '.svelte', '.ts', '.tsx']
const builtinPackageNames = new Set([
  ...builtinModules,
  ...builtinModules.map(name => `node:${name}`),
])
const frameworkRuntimePackages = new Set([
  '@holo-js/panels-next',
  '@holo-js/panels-nuxt',
  '@holo-js/panels-react',
  '@holo-js/panels-svelte',
  '@holo-js/panels-sveltekit',
  '@holo-js/panels-vue',
  '@sveltejs/kit',
  'next',
  'nuxt',
  'react',
  'react-dom',
  'svelte',
  'vue',
])
const rendererServerPackages = new Set([
  '@holo-js/auth',
  '@holo-js/authorization',
  '@holo-js/db',
  '@holo-js/forms',
  '@holo-js/media',
  '@holo-js/notifications',
  '@holo-js/queue',
  '@holo-js/storage',
  '@holo-js/validation',
])
const rendererPackages = new Set([
  '@holo-js/panels-react',
  '@holo-js/panels-svelte',
  '@holo-js/panels-vue',
])
const allowedWorkspaceDependencies = new Map([
  ['@holo-js/panels', new Set([
    '@holo-js/panels-cli',
    '@holo-js/panels-client',
    '@holo-js/panels-core',
    '@holo-js/panels-ui',
  ])],
  ['@holo-js/panels-cli', new Set(['@holo-js/panels-core'])],
  ['@holo-js/panels-client', new Set(['@holo-js/panels-core'])],
  ['@holo-js/panels-core', new Set()],
  ['@holo-js/panels-next', new Set(['@holo-js/panels-react'])],
  ['@holo-js/panels-nuxt', new Set(['@holo-js/panels-vue'])],
  ['@holo-js/panels-plugin-money', new Set([
    '@holo-js/panels-core',
    '@holo-js/panels-react',
    '@holo-js/panels-svelte',
    '@holo-js/panels-vue',
  ])],
  ['@holo-js/panels-react', new Set([
    '@holo-js/panels-client',
    '@holo-js/panels-core',
    '@holo-js/panels-ui',
  ])],
  ['@holo-js/panels-shield', new Set(['@holo-js/panels-cli', '@holo-js/panels-core'])],
  ['@holo-js/panels-svelte', new Set([
    '@holo-js/panels-client',
    '@holo-js/panels-core',
    '@holo-js/panels-ui',
  ])],
  ['@holo-js/panels-sveltekit', new Set(['@holo-js/panels-svelte'])],
  ['@holo-js/panels-testing', new Set([
    '@holo-js/panels-client',
    '@holo-js/panels-core',
    '@holo-js/panels-react',
    '@holo-js/panels-svelte',
    '@holo-js/panels-ui',
    '@holo-js/panels-vue',
  ])],
  ['@holo-js/panels-ui', new Set()],
  ['@holo-js/panels-vue', new Set([
    '@holo-js/panels-client',
    '@holo-js/panels-core',
    '@holo-js/panels-ui',
  ])],
])
const approvedPreimplementationImports = new Map([
  ['@holo-js/panels', new Map()],
  ['@holo-js/panels-next', new Map()],
  ['@holo-js/panels-nuxt', new Map()],
  ['@holo-js/panels-react', new Map()],
  ['@holo-js/panels-shield', new Map()],
  ['@holo-js/panels-svelte', new Map()],
  ['@holo-js/panels-sveltekit', new Map()],
  ['@holo-js/panels-testing', new Map()],
  ['@holo-js/panels-vue', new Map()],
])
const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

const manifests = new Map()

for (const directory of packageDirectories) {
  const manifestPath = new URL(`../packages/${directory}/package.json`, import.meta.url)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifests.set(manifest.name, { directory, manifest })
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const location = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(location))
    } else if (sourceExtensions.some(extension => entry.name.endsWith(extension))) {
      files.push(location)
    }
  }

  return files
}

function packageNameFromSpecifier(specifier) {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/')
  }
  return specifier.split('/', 1)[0]
}

function isPackageSpecifier(specifier) {
  return !specifier.startsWith('.')
    && !specifier.startsWith('/')
    && !specifier.startsWith('#')
    && !builtinPackageNames.has(specifier)
}

function extractModuleImports(source) {
  const imports = [...source.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/gu)]
    .map(match => ({ eager: true, specifier: match[1] }))
  const sourceFile = ts.createSourceFile(
    'architecture-source.ts',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  )
  function isTypeOnlyImport(node) {
    if (node.importClause?.isTypeOnly === true) {
      return true
    }

    const namedBindings = node.importClause?.namedBindings
    return node.importClause?.name === undefined
      && namedBindings !== undefined
      && ts.isNamedImports(namedBindings)
      && namedBindings.elements.every(element => element.isTypeOnly)
  }

  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly = ts.isImportDeclaration(node) ? isTypeOnlyImport(node) : node.isTypeOnly
      imports.push({ eager: !typeOnly, specifier: node.moduleSpecifier.text })
    }

    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteral(node.argument.literal)) {
      imports.push({ eager: false, specifier: node.argument.literal.text })
    }

    if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])) {
      imports.push({ eager: false, specifier: node.arguments[0].text })
    }

    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require'
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])) {
      imports.push({ eager: true, specifier: node.arguments[0].text })
    }

    if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)) {
      imports.push({ eager: !node.isTypeOnly, specifier: node.moduleReference.expression.text })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}

function packageExportsSubpath(manifest, exportKey) {
  if (exportKey === '.' && typeof manifest.exports === 'string') {
    return true
  }
  return typeof manifest.exports === 'object'
    && manifest.exports !== null
    && Object.hasOwn(manifest.exports, exportKey)
}

function validateDomainImport(packageName, importedPackage, eager) {
  if ((packageName === '@holo-js/panels-core'
    || packageName === '@holo-js/panels-client'
    || packageName === '@holo-js/panels-ui')
    && frameworkRuntimePackages.has(importedPackage)) {
    throw new Error(`${packageName} must not import framework runtime ${importedPackage}`)
  }

  if (rendererPackages.has(packageName) && rendererServerPackages.has(importedPackage)) {
    throw new Error(`${packageName} must not import server domain ${importedPackage}`)
  }

  if (packageName === '@holo-js/panels-cli'
    && eager
    && frameworkRuntimePackages.has(importedPackage)) {
    throw new Error(`${packageName} must not eagerly import framework runtime ${importedPackage}`)
  }
}

function validateSourceDependencies(packageName, manifest, sources) {
  const runtimeDependencies = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ])
  const importedPackages = new Set()

  for (const source of sources) {
    for (const { eager, specifier } of extractModuleImports(source)) {
      if (!isPackageSpecifier(specifier)) {
        continue
      }

      const importedPackage = packageNameFromSpecifier(specifier)
      importedPackages.add(importedPackage)
      validateDomainImport(packageName, importedPackage, eager)

      if (importedPackage === packageName) {
        continue
      }

      if (!runtimeDependencies.has(importedPackage)) {
        throw new Error(`${packageName} imports undeclared dependency ${importedPackage}`)
      }

      if (manifests.has(importedPackage)) {
        const subpath = specifier.slice(importedPackage.length)
        const exportKey = subpath ? `.${subpath}` : '.'
        if (!packageExportsSubpath(manifests.get(importedPackage).manifest, exportKey)) {
          throw new Error(`${packageName} imports non-exported subpath ${specifier}`)
        }
      }
    }
  }

  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    if (importedPackages.has(dependencyName)) {
      const staleException = approvedPreimplementationImports.get(packageName)?.get(dependencyName)
      if (staleException) {
        throw new Error(`${packageName} now imports ${dependencyName}; remove its preimplementation exception (${staleException})`)
      }
      continue
    }

    const reason = approvedPreimplementationImports.get(packageName)?.get(dependencyName)
    if (!reason) {
      throw new Error(`${packageName} declares unused runtime dependency ${dependencyName}`)
    }
  }
}

function validateWorkspaceBoundaries(packageManifests) {
  for (const [packageName, { manifest }] of packageManifests) {
    const allowedDependencies = allowedWorkspaceDependencies.get(packageName)
    if (!allowedDependencies) {
      throw new Error(`Missing workspace boundary policy for ${packageName}`)
    }

    const runtimeDependencies = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ])

    for (const dependencyName of runtimeDependencies) {
      if (packageManifests.has(dependencyName) && !allowedDependencies.has(dependencyName)) {
        throw new Error(`${packageName} must not depend on workspace package ${dependencyName}`)
      }
    }
  }
}

function assertDependencyValidationFails(packageName, manifest, sources, expectedMessage) {
  try {
    validateSourceDependencies(packageName, manifest, sources)
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) {
      return
    }
    throw error
  }
  throw new Error(`Architecture validator did not reject ${expectedMessage}`)
}

for (const [packageName, { manifest, packageRoot }] of [...manifests].map(([name, value]) => [
  name,
  {
    ...value,
    packageRoot: new URL(`../packages/${value.directory}/`, import.meta.url),
  },
])) {
  const sourceFiles = await collectSourceFiles(new URL('src/', packageRoot))
  const sources = await Promise.all(sourceFiles.map(sourceFile => readFile(sourceFile, 'utf8')))
  validateSourceDependencies(packageName, manifest, sources)
}

assertDependencyValidationFails(
  '@fixture/undeclared',
  {},
  ["import 'undeclared-runtime'"],
  'imports undeclared dependency undeclared-runtime',
)
assertDependencyValidationFails(
  '@holo-js/panels-client',
  { dependencies: { react: '1.0.0' } },
  ["import type { ReactNode } from 'react'"],
  'must not import framework runtime react',
)
assertDependencyValidationFails(
  '@holo-js/panels-react',
  { dependencies: { '@holo-js/db': '1.0.0' } },
  ["import type { Model } from '@holo-js/db'"],
  'must not import server domain @holo-js/db',
)
assertDependencyValidationFails(
  '@holo-js/panels-cli',
  { dependencies: { react: '1.0.0' } },
  ["import React from 'react'"],
  'must not eagerly import framework runtime react',
)

validateSourceDependencies(
  '@holo-js/panels-cli',
  { dependencies: { react: '1.0.0' } },
  ["export const load = () => import('react')"],
)
validateSourceDependencies(
  '@holo-js/panels-cli',
  { dependencies: { react: '1.0.0' } },
  ["import { type ReactNode } from 'react'\nexport type Node = ReactNode"],
)

validateWorkspaceBoundaries(manifests)

const invalidWorkspaceBoundaryFixture = new Map(manifests)
invalidWorkspaceBoundaryFixture.set('@holo-js/panels-core', {
  directory: 'core',
  manifest: {
    dependencies: {
      '@holo-js/panels-shield': 'workspace:*',
    },
  },
})

try {
  validateWorkspaceBoundaries(invalidWorkspaceBoundaryFixture)
  throw new Error('Architecture validator did not reject core depending on shield')
} catch (error) {
  if (!(error instanceof Error)
    || !error.message.includes('@holo-js/panels-core must not depend on workspace package @holo-js/panels-shield')) {
    throw error
  }
}
assertDependencyValidationFails(
  '@fixture/unused',
  { dependencies: { 'unused-runtime': '1.0.0' } },
  ['export {}'],
  'declares unused runtime dependency unused-runtime',
)

const dependencyGraph = new Map()

for (const [name, { manifest }] of manifests) {
  const dependencyNames = Object.keys(manifest.dependencies ?? {})
    .filter(dependencyName => manifests.has(dependencyName))
    .sort()
  dependencyGraph.set(name, dependencyNames)
}

const visiting = new Set()
const visited = new Set()

function visit(name, path) {
  if (visiting.has(name)) {
    throw new Error(`Workspace dependency cycle: ${[...path, name].join(' -> ')}`)
  }

  if (visited.has(name)) {
    return
  }

  visiting.add(name)
  for (const dependencyName of dependencyGraph.get(name) ?? []) {
    visit(dependencyName, [...path, name])
  }
  visiting.delete(name)
  visited.add(name)
}

for (const name of [...manifests.keys()].sort()) {
  visit(name, [])
}

const expectedFrameworkDependencies = new Map([
  ['@holo-js/panels-next', '@holo-js/panels-react'],
  ['@holo-js/panels-nuxt', '@holo-js/panels-vue'],
  ['@holo-js/panels-sveltekit', '@holo-js/panels-svelte'],
])

for (const [adapter, renderer] of expectedFrameworkDependencies) {
  const dependencies = dependencyGraph.get(adapter) ?? []
  if (!dependencies.includes(renderer)) {
    throw new Error(`${adapter} must depend on ${renderer}`)
  }

  const unexpectedRenderer = dependencies.find(dependency => (
    dependency === '@holo-js/panels-react'
    || dependency === '@holo-js/panels-vue'
    || dependency === '@holo-js/panels-svelte'
  ) && dependency !== renderer)
  if (unexpectedRenderer) {
    throw new Error(`${adapter} must not depend on ${unexpectedRenderer}`)
  }
}

console.log(`Validated architecture for ${manifests.size} packages`)
