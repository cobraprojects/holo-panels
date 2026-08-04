import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import commands from '../dist/index.mjs'

const projectRoot = await mkdtemp(join(tmpdir(), 'panels-cli-built-smoke-'))

try {
  await mkdir(join(projectRoot, 'config'), { recursive: true })
  await writeFile(join(projectRoot, 'config/app.ts'), "export default { plugins: ['@holo-js/panels'] }\n")
  await writeFile(join(projectRoot, 'package.json'), '{"dependencies":{"next":"1.0.0"}}\n')
  const command = commands.find(candidate => candidate.name === 'panels:publish-ui')
  if (!command) throw new Error('Built CLI does not contribute panels:publish-ui')
  await command.run({
    args: [],
    cwd: projectRoot,
    flags: {},
    projectRoot,
    loadProject: async () => ({}),
  })
  const manifest = JSON.parse(await readFile(join(projectRoot, '.holo-js/panels/published-ui.json'), 'utf8'))
  if (manifest.framework !== 'next' || manifest.files.length === 0) throw new Error('Built CLI did not publish packaged Next.js assets')
} finally {
  await rm(projectRoot, { force: true, recursive: true })
}
