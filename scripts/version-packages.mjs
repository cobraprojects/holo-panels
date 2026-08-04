import { readFile, readdir, writeFile } from 'node:fs/promises'

const version = process.argv[2]
const stableVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/

if (!version || !stableVersionPattern.test(version)) {
  throw new Error('Provide a valid semantic version, for example: bun run version-packages 1.0.0')
}

const packagesRoot = new URL('../packages/', import.meta.url)
const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

for (const directory of packageDirectories) {
  const manifestPath = new URL(`../packages/${directory}/package.json`, import.meta.url)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.version = version
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

console.log(`Updated ${packageDirectories.length} packages to ${version}`)
