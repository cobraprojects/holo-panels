import { act, createElement, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { FormStore } from '@holo-js/panels-client'
import { afterEach, describe, expect, it } from 'vitest'
import {
  Button,
  ComponentRegistry,
  createDefaultComponentRegistry,
  useFormStore,
} from '../src/index'

const mounted: Array<{ readonly container: HTMLDivElement, readonly unmount: () => void }> = []

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    act(entry.unmount)
    entry.container.remove()
  }
})

describe('React renderer registry', () => {
  it('resolves named registrations and explicit panel overrides', () => {
    const CustomButton: ComponentType<{ readonly label: string }> = ({ label }) => createElement('button', null, label)
    const PanelButton: ComponentType<{ readonly label: string }> = ({ label }) => createElement('button', null, `Panel ${label}`)
    const registry = createDefaultComponentRegistry()
      .register('application-widget', CustomButton, 'app/panels/components.ts')
      .override('staff', 'application-widget', PanelButton, 'app/panels/staff.ts')

    expect(registry.has('button')).toBe(false)
    expect(registry.resolve('application-widget')).toBe(CustomButton)
    expect(registry.resolve('application-widget', 'staff')).toBe(PanelButton)
    expect(registry.has('application-widget', 'staff')).toBe(true)
  })

  it('rejects duplicates and reports registration sources for missing components', () => {
    const registry = new ComponentRegistry().register('field', Button, 'plugin-a/renderer.ts')

    expect(() => registry.register('field', Button, 'plugin-b/renderer.ts')).toThrow(
      'plugin-b/renderer.ts conflicts with its registration from plugin-a/renderer.ts',
    )
    expect(() => registry.resolve('missing', 'admin', 'app/panels/posts.ts:42')).toThrow(
      'Missing React component "missing" for panel "admin", requested from app/panels/posts.ts:42.',
    )
  })
})

describe('React client-store binding', () => {
  it('subscribes through useSyncExternalStore and preserves shared store semantics', () => {
    const store = new FormStore({ name: 'Ada', nested: { active: true } })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted.push({ container, unmount: () => root.unmount() })

    function Fixture() {
      const name = useFormStore(store, state => state.values.name)
      return createElement('output', null, name)
    }

    act(() => root.render(createElement(Fixture)))
    expect(container.textContent).toBe('Ada')

    act(() => store.set('name', 'Grace'))
    expect(container.textContent).toBe('Grace')
    expect(store.state.dirtyPaths).toEqual(['name'])
  })
})
