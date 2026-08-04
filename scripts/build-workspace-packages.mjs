import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPackagesInDependencyOrder } from './build-compatible-holo.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

await buildPackagesInDependencyOrder(resolve(repositoryRoot))
