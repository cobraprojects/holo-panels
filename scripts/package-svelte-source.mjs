import { cp, mkdir, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repositoryRoot = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const packageRoot = await realpath(process.cwd())
const packagePath = relative(repositoryRoot, packageRoot)
if (packagePath !== 'packages/svelte' && packagePath !== 'packages/sveltekit') throw new Error(`Unsupported Svelte package root: ${packageRoot}`)

const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
if (manifest.name !== '@holo-js/panels-svelte' && manifest.name !== '@holo-js/panels-sveltekit') throw new Error(`Unsupported Svelte package: ${String(manifest.name)}`)

const sourceRoot = join(packageRoot, 'src')
const outputRoot = join(packageRoot, 'dist', 'svelte')

async function sourceFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await sourceFiles(path))
    else files.push(path)
  }
  return files
}

const files = await sourceFiles(sourceRoot)
const entryPoints = files.filter(path => extname(path) === '.ts')
await rm(outputRoot, { force: true, recursive: true })
await mkdir(outputRoot, { recursive: true })
await build({
  bundle: false,
  entryPoints,
  format: 'esm',
  outbase: sourceRoot,
  outdir: outputRoot,
  platform: 'neutral',
  sourcemap: false,
  target: 'es2022',
})

for (const source of files.filter(path => path.endsWith('.svelte') || path.endsWith('.css'))) {
  const target = join(outputRoot, relative(sourceRoot, source))
  await mkdir(dirname(target), { recursive: true })
  await cp(source, target)
}
