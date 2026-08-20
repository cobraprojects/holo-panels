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
  panelColorAppearance,
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
    expect(panelThemeVariables({ colors: { surfaceSubtle: '#fafafa' } })['--holo-color-surface-subtle']).toBe('#fafafa')
    expect(panelThemeStyleAttribute(theme)).toContain('--holo-color-primary:#00a8cc')
    expect(darkPanelTheme.tokens['color-primary']).toBe('#8da2fb')
    expect(() => definePanelTheme('  ', 'light')).toThrow('cannot be empty')
    expect(() => definePanelTheme('Unsafe', 'light', { 'color-primary': 'red; background: black' })).toThrow('unsafe value')
  })

  it('normalizes semantic colors and safely preserves custom CSS colors', () => {
    expect(panelColorAppearance(' Success ')).toEqual({
      attribute: 'success',
      custom: undefined,
    })
    expect(panelColorAppearance('#123456')).toEqual({
      attribute: '#123456',
      custom: '#123456',
    })
    expect(panelColorAppearance('red; background: black')).toEqual({
      attribute: undefined,
      custom: undefined,
    })
  })

  it('covers semantic, foundational, and admin component token families', () => {
    for (const token of [
      'color-surface-overlay',
      'color-content-disabled',
      'color-border-strong',
      'color-info',
      'color-hover',
      'color-active',
      'color-selected',
      'color-backdrop',
      'font-serif',
      'font-size-3xl',
      'control-height-sm',
      'shadow-xl',
      'motion-slow',
      'shell-background',
      'nav-item-active',
      'button-primary-background',
      'input-focus-border',
      'table-row-selected',
      'popover-background',
      'dialog-backdrop',
      'notification-success-accent',
      'loading-track',
      'form-error-content',
      'relation-connector',
      'auth-card-background',
      'widget-header-background',
    ] as const) {
      expect(panelTokenNames).toContain(token)
      expect(lightPanelTheme.tokens[token]).toBeTruthy()
      expect(darkPanelTheme.tokens[token]).toBeTruthy()
    }
  })

  it('emits custom variables deterministically with documented precedence', () => {
    const input = {
      colors: { primary: '#111111' },
      tokens: {
        'z-brand-accent': '#eeeeee',
        'font-serif': 'Token Serif',
        'color-primary': '#222222',
        'font-sans': 'Token Sans',
        'a-brand-accent': '#dddddd',
        'font-mono': 'Token Mono',
      },
      fontFamily: 'Explicit Sans',
      monoFontFamily: 'Explicit Mono',
      serifFontFamily: 'Explicit Serif',
    }
    const variables = panelThemeVariables(input)
    const reversedVariables = panelThemeVariables({
      ...input,
      tokens: Object.fromEntries(Object.entries(input.tokens).reverse()),
    })

    expect(variables).toEqual({
      '--holo-a-brand-accent': '#dddddd',
      '--holo-color-primary': '#222222',
      '--holo-z-brand-accent': '#eeeeee',
      '--holo-font-sans': 'Explicit Sans',
      '--holo-font-mono': 'Explicit Mono',
      '--holo-font-serif': 'Explicit Serif',
    })
    expect(Object.keys(variables)).toEqual([
      '--holo-a-brand-accent',
      '--holo-color-primary',
      '--holo-z-brand-accent',
      '--holo-font-sans',
      '--holo-font-mono',
      '--holo-font-serif',
    ])
    expect(panelThemeStyleAttribute(input)).toBe(panelThemeStyleAttribute({
      ...input,
      tokens: Object.fromEntries(Object.entries(input.tokens).reverse()),
    }))
    expect(reversedVariables).toEqual(variables)
    expect(variables).not.toHaveProperty('--holo-color-background')
  })

  it('supports validated custom tokens in defined themes', () => {
    const theme = definePanelTheme('Branded', 'light', {
      'brand-accent': 'oklch(62% 0.2 260)',
      'widget-gap': '2rem',
    })

    expect(theme.tokens['brand-accent']).toBe('oklch(62% 0.2 260)')
    expect(panelThemeVariables(theme)['--holo-brand-accent']).toBe('oklch(62% 0.2 260)')
    expect(theme.tokens['widget-gap']).toBe('2rem')
  })

  it('rejects unsafe custom names and values from every theme source', () => {
    for (const name of ['', '--escape', 'Bad-Token', 'bad token', 'bad;token', 'bad_token']) {
      expect(() => panelThemeVariables({ tokens: { [name]: 'red' } })).toThrow('unsafe name')
      expect(() => definePanelTheme('Unsafe', 'light', { [name]: 'red' })).toThrow('unsafe name')
    }

    for (const value of [
      '',
      'red; color: blue',
      'red { color: blue }',
      'url(https://example.test/x)',
      'expression(alert(1))',
      '@import "evil.css"',
      'red/* hide following declarations */',
      '</style><script>alert(1)</script>',
      `red\nblue`,
      'x'.repeat(257),
    ]) {
      expect(() => panelThemeVariables({ tokens: { 'brand-accent': value } })).toThrow('unsafe value')
    }

    expect(() => panelThemeVariables({ colors: { primary: 'red;--escape:1' } })).toThrow('unsafe value')
    expect(() => panelThemeVariables({ fontFamily: 'sans-serif;--escape:1' })).toThrow('unsafe value')
    expect(() => panelThemeVariables({ monoFontFamily: 'url(evil)' })).toThrow('unsafe value')
    expect(() => panelThemeVariables({ serifFontFamily: '</style>' })).toThrow('unsafe value')
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
      '.hp-panel-main-header',
      '.hp-panel-main-body',
      '.hp-panel-actions--compact',
      '.hp-notification-inbox-header',
      '.hp-notification-item-content',
      '.hp-notification-toast-content',
      '.hp-relation-manager-header',
      '.hp-table-responsive',
      '.hp-relation-dialog-footer',
    ]) {
      expect(css).toContain(selector)
    }
    for (const tokenName of panelTokenNames) {
      expect(css).toContain(`${panelTokenVariable(tokenName)}:`)
    }
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toMatch(/\[data-theme=["']dark["']\]/u)
    expect(css.match(/@layer hp-panels/gu)).toHaveLength(1)
    expect(css).not.toContain('!important')
    expect(css).not.toContain('@tailwind')
    expect(css).not.toContain('@apply')
    expect(css).not.toContain(':root:has(.hp-panel')
    expect(css).not.toMatch(/\/\s*span\s+var\(--hp-filter-column-span-/u)
    expect(css).toContain(
      'var(--hp-filter-column-span-default, span 1)',
    )
    expect(css).toContain(
      '.hp-panel-navigation--topbar[data-open="true"]',
    )
    expect(css).toMatch(
      /\[dir="rtl"\] \.hp-panel-sidebar\)[^{]*\{[^}]*transform: translateX\(105%\)/u,
    )
    for (const color of ['primary', 'success', 'warning', 'danger', 'info']) {
      expect(css).toContain(`.hp-widget-stat[data-color="${color}"]`)
    }
    expect(css).toContain(
      'color: var(--hp-widget-color, var(--holo-color-content))',
    )

    const defaultsEnd = css.indexOf('\n  :where(.hp-panel, [data-holo-panel]) {')
    expect(defaultsEnd).toBeGreaterThan(0)
    const darkThemeStart = css.indexOf('\n  :where(.hp-panel, [data-holo-panel])[data-theme="dark"]')
    expect(darkThemeStart).toBeGreaterThan(defaultsEnd)
    const panelScope = css.slice(defaultsEnd, darkThemeStart)
    for (const semantic of [
      '--holo-shell-background: var(--holo-color-background)',
      '--holo-button-primary-background: var(--holo-color-primary)',
      '--holo-input-background: var(--holo-color-surface)',
      '--holo-table-background: var(--holo-color-surface)',
      '--holo-relation-content: var(--holo-color-content)',
      '--holo-widget-background: var(--holo-color-surface)',
    ]) expect(panelScope).toContain(semantic)

    const componentRules = css.slice(defaultsEnd)
    expect(componentRules).not.toMatch(/#[0-9a-f]{3,8}\b/iu)
    expect(componentRules).not.toMatch(/\brgba?\(/iu)
  })
})
