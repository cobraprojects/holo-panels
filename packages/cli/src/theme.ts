import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PANEL_THEME_ARTIFACT_PATH = 'theme.css'
export const PANEL_THEME_CUSTOMIZATION_PATH = 'resources/css/holo-panels/theme.css'

type PanelThemeBuildOptions = {
  readonly projectRoot: string
}

function cssPath(path: string): string {
  return path.replaceAll('\\', '/').replaceAll("'", "\\'")
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function panelThemeSource(projectRoot: string): Promise<string> {
  const customizationPath = resolve(projectRoot, PANEL_THEME_CUSTOMIZATION_PATH)
  const imports = [
    `@import '${cssPath(fileURLToPath(import.meta.resolve('@holo-js/panels-ui/theme-source.css')))}';`,
    `@import '${cssPath(fileURLToPath(import.meta.resolve('@holo-js/panels-ui/style.css')))}';`,
    ...(await exists(customizationPath) ? [`@import '${cssPath(customizationPath)}';`] : []),
  ]
  return `${imports.join('\n')}\n@source '${cssPath(resolve(projectRoot, 'resources/panels/**/*.{js,jsx,ts,tsx,svelte,vue}'))}';\n`
}

function tailwindExecutable(): string {
  const manifestPath = fileURLToPath(import.meta.resolve('@tailwindcss/cli/package.json'))
  return resolve(dirname(manifestPath), 'dist/index.mjs')
}

async function runTailwind(input: string, output: string, watch: boolean): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tailwindExecutable(), '-i', input, '-o', output, '--minify', ...(watch ? ['--watch'] : [])], {
      stdio: watch ? 'inherit' : ['ignore', 'ignore', 'pipe'],
    })
    let errorOutput = ''
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', chunk => { errorOutput += String(chunk) })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(new Error(`[Holo Panels] Theme compilation failed${signal ? ` after ${signal}` : ''}${errorOutput.trim() ? `: ${errorOutput.trim()}` : '.'}`))
    })
  })
}

export async function buildPanelTheme(options: PanelThemeBuildOptions): Promise<string> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'holo-panels-theme-'))
  const input = join(temporaryRoot, 'theme.css')
  const output = join(temporaryRoot, 'compiled.css')
  try {
    await writeFile(input, await panelThemeSource(options.projectRoot), 'utf8')
    await runTailwind(input, output, false)
    return await readFile(output, 'utf8')
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

export async function writePanelTheme(options: PanelThemeBuildOptions): Promise<string> {
  const output = resolve(options.projectRoot, '.holo-js/generated/panels', PANEL_THEME_ARTIFACT_PATH)
  const temporaryOutput = `${output}.tmp`
  await mkdir(dirname(output), { recursive: true })
  await writeFile(temporaryOutput, await buildPanelTheme(options), 'utf8')
  await rename(temporaryOutput, output)
  return output
}

export async function watchPanelTheme(options: PanelThemeBuildOptions): Promise<void> {
  const cacheRoot = resolve(options.projectRoot, '.holo-js/cache/panels')
  const output = resolve(options.projectRoot, '.holo-js/generated/panels', PANEL_THEME_ARTIFACT_PATH)
  const input = resolve(cacheRoot, 'theme.css')
  await mkdir(cacheRoot, { recursive: true })
  await mkdir(dirname(output), { recursive: true })
  await writeFile(input, await panelThemeSource(options.projectRoot), 'utf8')
  await runTailwind(input, output, true)
}
