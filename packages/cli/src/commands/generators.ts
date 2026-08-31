import { spawn } from 'node:child_process'
import { basename } from 'node:path'
import { generate, type GeneratorKind, type GeneratorProject } from '../generators'

type CommandFlagValue = string | boolean | number | readonly string[]

export type GeneratorCommandContext = {
  readonly projectRoot: string
  readonly args: readonly string[]
  readonly flags: Readonly<Record<string, CommandFlagValue>>
  loadProject(): Promise<GeneratorProject>
}

export type GeneratorCommand = {
  readonly description: string
  readonly name: string
  run(context: GeneratorCommandContext): Promise<void>
  readonly usage: string
}

function runPreparation(projectRoot: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const cliPath = process.argv[1]
    const runningHoloCli = typeof cliPath === 'string' && ['holo', 'holo-js', 'holo.mjs'].includes(basename(cliPath))
    const executable = runningHoloCli ? process.execPath : 'holo'
    const args = runningHoloCli ? [cliPath, 'prepare'] : ['prepare']
    const child = spawn(executable, args, { cwd: projectRoot, shell: false, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`[Holo Panels] Preparation failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`))
    })
  })
}

function command(kind: GeneratorKind, usage: string): GeneratorCommand {
  return Object.freeze({
    name: `make:${kind}`,
    description: `Generate a Holo Panels ${kind}.`,
    usage,
    async run(context): Promise<void> {
      const project = await context.loadProject()
      const files = await generate({
        args: context.args,
        flags: context.flags,
        kind,
        project,
        projectRoot: context.projectRoot,
      }, { prepare: () => runPreparation(context.projectRoot) })
      process.stdout.write(`[Holo Panels] Generated ${files.join(', ')}.\n`)
    },
  })
}

export const generatorCommands: readonly GeneratorCommand[] = Object.freeze([
  command('panel', 'holo make:panel <panel> [--path /admin] [--guard admin] [--default]'),
  command('resource', 'holo make:resource <Model> [--panel admin] [--split] [--generate] [--simple]'),
  command('page', 'holo make:page <Name> [--panel admin]'),
  command('resource-page', 'holo make:resource-page <Name> --resource <Resource> [--panel admin]'),
  command('relation-manager', 'holo make:relation-manager <Name> --resource <Resource> [--panel admin]'),
  command('form-field', 'holo make:form-field <Name> [--panel admin]'),
  command('infolist-entry', 'holo make:infolist-entry <Name> [--panel admin]'),
  command('table-column', 'holo make:table-column <Name> [--panel admin]'),
  command('filter', 'holo make:filter <Name> [--panel admin]'),
  command('action', 'holo make:action <Name> [--panel admin]'),
  command('widget', 'holo make:widget <Name> [--panel admin] [--resource PostResource]'),
  command('cluster', 'holo make:cluster <Name> [--panel admin]'),
  command('importer', 'holo make:importer <Name> --resource <Resource> [--panel admin]'),
  command('exporter', 'holo make:exporter <Name> --resource <Resource> [--panel admin]'),
])
