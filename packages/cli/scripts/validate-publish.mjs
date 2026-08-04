import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'publish')
const checksumPattern = /^[a-f0-9]{64}$/u
const decoder = new TextDecoder('utf-8', { fatal: true })

function safePath(path) {
  return path && !path.includes('\\') && !path.includes('\0') && !path.startsWith('/') && posix.normalize(path) === path && path.split('/').every(segment => segment && segment !== '.' && segment !== '..')
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
}

async function filesBelow(directory, base = directory) {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link in publish source: ${relative(base, path)}`)
    if (entry.isDirectory()) paths.push(...await filesBelow(path, base))
    else if (entry.isFile()) paths.push(relative(base, path).split('\\').join('/'))
    else throw new Error(`Special file in publish source: ${relative(base, path)}`)
  }
  return paths.sort()
}

for (const framework of ['next', 'nuxt', 'sveltekit']) {
  const frameworkRoot = join(root, framework)
  const manifestPath = join(frameworkRoot, 'manifest.json')
  const sourceRoot = join(frameworkRoot, 'src')
  if (!(await lstat(manifestPath)).isFile() || !(await lstat(sourceRoot)).isDirectory()) throw new Error(`Invalid ${framework} publish paths`)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (!exactKeys(manifest, ['version', 'framework', 'files']) || manifest.version !== 1 || manifest.framework !== framework || !Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error(`Invalid ${framework} publish manifest`)
  if (manifest.files.some(file => !exactKeys(file, ['path', 'checksum']))) throw new Error(`Invalid ${framework} publish file entry`)
  const paths = manifest.files.map(file => file.path)
  if (paths.some((path, index) => !safePath(path) || path !== [...paths].sort()[index]) || new Set(paths).size !== paths.length) throw new Error(`Unsafe, unsorted, or duplicate ${framework} publish path`)
  const actual = await filesBelow(sourceRoot)
  if (actual.join('\n') !== paths.join('\n')) throw new Error(`${framework} publish manifest does not exactly cover src`)
  let total = 0
  for (const file of manifest.files) {
    if (!checksumPattern.test(file.checksum)) throw new Error(`Invalid checksum for ${framework}/${file.path}`)
    const path = join(frameworkRoot, 'src', ...file.path.split('/'))
    if (!(await lstat(path)).isFile()) throw new Error(`Non-regular publish source: ${framework}/${file.path}`)
    const bytes = await readFile(path)
    total += bytes.byteLength
    if (bytes.byteLength > 2 * 1024 * 1024 || total > 32 * 1024 * 1024 || bytes.includes(0)) throw new Error(`Invalid publish source size or content: ${framework}/${file.path}`)
    decoder.decode(bytes)
    if (createHash('sha256').update(bytes).digest('hex') !== file.checksum) throw new Error(`Checksum mismatch for ${framework}/${file.path}`)
  }
}
