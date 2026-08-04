import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const holoCliPath = resolve(root, '../holo-js/packages/cli/dist/bin/holo.mjs')
const examples = ['example-next', 'example-nuxt', 'example-sveltekit']

async function buildExample(example) {
  const applicationRoot = resolve(root, 'apps', example)
  await mkdir(resolve(applicationRoot, 'storage'), { recursive: true })

  return await new Promise((resolveBuild, rejectBuild) => {
    const frameworkArgs = example === 'example-next' ? ['--webpack'] : []
    const child = spawn(process.execPath, [holoCliPath, 'build', ...frameworkArgs], {
      cwd: applicationRoot,
      env: process.env,
      stdio: 'inherit',
    })

    child.once('error', rejectBuild)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveBuild()
        return
      }

      rejectBuild(new Error(`${example} build failed with ${signal ?? `exit code ${String(code)}`}`))
    })
  })
}

for (const example of examples) {
  await buildExample(example)
}
