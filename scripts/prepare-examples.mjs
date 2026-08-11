import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const holoRoot = resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? resolve(repositoryRoot, '../holo-js'))
const holoCliPath = resolve(holoRoot, 'packages/cli/dist/bin/holo.mjs')
const examples = Object.freeze([
  'example-next',
  'example-nuxt',
  'example-sveltekit',
])

async function runHoloCommand(example, command) {
  const applicationRoot = resolve(repositoryRoot, 'apps', example)
  await new Promise((resolvePreparation, rejectPreparation) => {
    const child = spawn(process.execPath, [holoCliPath, command], {
      cwd: applicationRoot,
      env: process.env,
      stdio: 'inherit',
    })

    child.once('error', rejectPreparation)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePreparation()
        return
      }

      rejectPreparation(new Error(`${example} ${command} failed with ${signal ?? `exit code ${String(code)}`}`))
    })
  })
}

export async function prepareExamples(runCommand = runHoloCommand) {
  for (const example of examples) {
    await runCommand(example, 'prepare')
    await runCommand(example, 'migrate')
    console.log(`Prepared generated Holo and Panels metadata for ${example}`)
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined
if (invokedPath === fileURLToPath(import.meta.url)) {
  await prepareExamples()
}
