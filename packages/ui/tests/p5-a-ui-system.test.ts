import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  accessibilityPatterns,
  componentConformanceFixtures,
  createFieldAccessibilityIds,
  darkPanelTheme,
  definePanelIcon,
  definePanelTheme,
  lightPanelTheme,
  panelIconNames,
  panelThemeStyleAttribute,
  panelThemeVariables,
  PanelIconRegistry,
  panelTokenNames,
  panelTokenVariable,
  shellPrimitiveNames,
  shellReferenceStates,
} from '../src/index'

describe('P5-A design tokens', () => {
  it('provides complete light and dark semantic themes', () => {
    expect(Object.keys(lightPanelTheme.tokens).sort()).toEqual([...panelTokenNames].sort())
    expect(Object.keys(darkPanelTheme.tokens).sort()).toEqual([...panelTokenNames].sort())
    expect(lightPanelTheme.colorScheme).toBe('light')
    expect(darkPanelTheme.colorScheme).toBe('dark')
    expect(panelTokenVariable('color-primary')).toBe('--holo-color-primary')
  })

  it('creates named themes without mutating the defaults', () => {
    const theme = definePanelTheme('Ocean', 'dark', { 'color-primary': '#00a8cc' })

    expect(theme.name).toBe('Ocean')
    expect(theme.tokens['color-primary']).toBe('#00a8cc')
    expect(panelThemeVariables(theme)['--holo-color-primary']).toBe('#00a8cc')
    expect(panelThemeVariables({ colors: { primary: '#7c3aed' } })['--holo-color-primary']).toBe('#7c3aed')
    expect(panelThemeStyleAttribute(theme)).toContain('--holo-color-primary:#00a8cc')
    expect(darkPanelTheme.tokens['color-primary']).toBe('#8da2fb')
    expect(() => definePanelTheme('  ', 'light')).toThrow('cannot be empty')
    expect(() => definePanelTheme('Unsafe', 'light', { 'color-primary': 'red; background: black' })).toThrow('unsafe value')
  })
})

describe('P5-A icon contracts', () => {
  const search = definePanelIcon({
    name: 'search',
    viewBox: '0 0 24 24',
    paths: [{ path: 'M10 2a8 8 0 1 0 4.9 14.3L20.6 22l1.4-1.4-5.7-5.7A8 8 0 0 0 10 2z', fill: 'currentColor' }],
  })

  it('registers immutable framework-neutral icon geometry', () => {
    const registry = new PanelIconRegistry([search])
    const scoped = registry.scoped()

    expect(registry.get('search')).toEqual(search)
    expect(scoped.get('search')).toEqual(search)
    expect(panelIconNames).toContain('search')
    expect(() => registry.register(search)).toThrow('already registered')
    expect(() => registry.get('missing')).toThrow('not registered')
  })

  it('allows an explicit scoped replacement without changing the parent', () => {
    const registry = new PanelIconRegistry([search])
    const scoped = registry.scoped()
    const replacement = definePanelIcon({
      name: 'search',
      viewBox: '0 0 16 16',
      paths: [{ path: 'M1 1h14v14H1z', fill: 'none', stroke: 'currentColor' }],
    })

    scoped.register(replacement, { replace: true })

    expect(scoped.get('search').viewBox).toBe('0 0 16 16')
    expect(registry.get('search').viewBox).toBe('0 0 24 24')
  })
})

describe('P5-A accessibility and conformance contracts', () => {
  it('specifies every required accessibility interaction family', () => {
    expect(Object.keys(accessibilityPatterns).sort()).toEqual([
      'combobox',
      'data-table',
      'dialog',
      'field',
      'focus-trap',
      'live-region',
      'menu',
      'tabs',
    ])
    expect(accessibilityPatterns['focus-trap'].keyboard.map(binding => binding.key)).toContain('Tab')
    expect(accessibilityPatterns.combobox.requiredAttributes).toContain('aria-activedescendant')
    expect(accessibilityPatterns['data-table'].requiredAttributes).toContain('aria-sort')
  })

  it('creates stable label, description, and error associations', () => {
    expect(createFieldAccessibilityIds('profile-name')).toEqual({
      control: 'profile-name-control',
      label: 'profile-name-label',
      description: 'profile-name-description',
      error: 'profile-name-error',
    })
    expect(() => createFieldAccessibilityIds(' ')).toThrow('cannot be empty')
  })

  it('defines every renderer primitive and deterministic visual reference state', () => {
    expect(componentConformanceFixtures.map(fixture => fixture.component).sort()).toEqual([...shellPrimitiveNames].sort())
    expect(new Set(shellReferenceStates.map(state => state.id)).size).toBe(shellReferenceStates.length)
    expect(shellReferenceStates).toContainEqual(expect.objectContaining({ direction: 'rtl' }))
    expect(shellReferenceStates).toContainEqual(expect.objectContaining({ state: 'validation-errors' }))
    expect(shellReferenceStates).toContainEqual(expect.objectContaining({ density: 'compact' }))
  })
})

describe('P5-A compiled semantic CSS', () => {
  it('ships framework-neutral states without Tailwind directives', async () => {
    const cssPath = fileURLToPath(new URL('../src/style.css', import.meta.url))
    const css = await readFile(cssPath, 'utf8')

    for (const selector of [
      '.hp-panel-shell',
      '.hp-panel-navigation',
      '.hp-field',
      '.hp-table',
      '.hp-dialog',
      '.hp-panel-popover',
      '.hp-notification',
      '.hp-panel-loading',
      '.hp-auth-page',
      '.hp-auth-card',
    ]) {
      expect(css).toContain(selector)
    }
    for (const tokenName of panelTokenNames) {
      expect(css).toContain(`${panelTokenVariable(tokenName)}:`)
    }
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain("[data-theme='dark']")
    expect(css).not.toContain('@tailwind')
    expect(css).not.toContain('@apply')
  })
})
