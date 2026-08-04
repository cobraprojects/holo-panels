import { spawnSync } from 'node:child_process'

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function normalizedOutput(output) {
  if (typeof output === 'string') return output.trim()
  if (Buffer.isBuffer(output)) return output.toString('utf8').trim()
  return ''
}

export function validateNpmPublishAuthentication(options = {}) {
  const spawn = options.spawn ?? spawnSync
  const cwd = options.cwd ?? process.cwd()
  const result = spawn(npmExecutable, ['whoami'], {
    cwd,
    encoding: 'utf8',
  })

  if (result.error) throw result.error

  if (result.status !== 0) {
    const output = [normalizedOutput(result.stderr), normalizedOutput(result.stdout)]
      .filter(Boolean)
      .join('\n')
    const detail = output.length > 0 ? `\n\nnpm whoami output:\n${output}` : ''

    throw new Error([
      'Cannot publish Holo Panels packages because npm authentication failed.',
      'Run `npm login` or configure an npm token with publish access to the @holo-js scope, then retry `bun run release`.',
    ].join('\n') + detail)
  }

  return normalizedOutput(result.stdout)
}
