import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const holoCliPath = resolve(root, '../holo-js/packages/cli/dist/bin/holo.mjs')
const definitions = Object.freeze({
  next: {
    app: 'example-next',
    parameters: port => ['start', '--hostname', '127.0.0.1', '--port', port],
  },
  nuxt: {
    app: 'example-nuxt',
    parameters: () => ['start'],
  },
  sveltekit: {
    app: 'example-sveltekit',
    parameters: () => ['start'],
  },
})

const [example, port] = process.argv.slice(2)
const definition = definitions[example]

if (!definition || !port || !/^\d+$/.test(port)) {
  throw new TypeError('Usage: node tests/e2e/start-example.mjs <next|nuxt|sveltekit> <port>')
}

const applicationRoot = resolve(root, 'apps', definition.app)
const appKey = 'holo-panels-playwright-example-signing-key'
const runtime = resolve(applicationRoot, '.holo-js/framework/run.mjs')
const prepared = spawnSync(process.execPath, [holoCliPath, 'migrate:fresh', '--seed', '--force'], {
  cwd: applicationRoot,
  env: { ...process.env, APP_KEY: appKey, NODE_ENV: 'test' },
  stdio: 'inherit',
})

if (prepared.status !== 0) process.exit(prepared.status ?? 1)

const server = spawn(
  process.execPath,
  [runtime, ...definition.parameters(port)],
  {
    cwd: applicationRoot,
    env: { ...process.env, APP_KEY: appKey, HOST: '127.0.0.1', NODE_ENV: 'production', ORIGIN: `http://127.0.0.1:${port}`, PORT: port },
    stdio: 'inherit',
  },
)

const stop = signal => server.kill(signal)

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))
server.once('error', error => {
  throw error
})
server.once('exit', code => {
  process.exitCode = code ?? 1
})
