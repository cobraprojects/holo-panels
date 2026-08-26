import { Window } from 'happy-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installPanelSpaNavigation } from '../src/navigation/spa'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('panel SPA navigation', () => {
  it('leaves fragment navigation to the browser', () => {
    const window = new Window({ url: 'https://example.test/admin/posts' })
    vi.stubGlobal('document', window.document)
    vi.stubGlobal('Element', window.Element)
    vi.stubGlobal('HTMLAnchorElement', window.HTMLAnchorElement)
    vi.stubGlobal('location', window.location)
    vi.stubGlobal('MouseEvent', window.MouseEvent)
    const root = document.createElement('main')
    const link = document.createElement('a')
    link.href = '#details'
    root.append(link)
    document.body.append(root)
    const navigate = vi.fn()
    const uninstall = installPanelSpaNavigation(root, { exceptions: [], navigate, prefetching: true })

    const click = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    link.dispatchEvent(click)
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(click.defaultPrevented).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(document.head.querySelector('link[data-holo-panel-prefetch]')).toBeNull()
    uninstall()
  })

  it('intercepts only unmodified same-origin document destinations', () => {
    const window = new Window({ url: 'https://example.test/admin/posts' })
    vi.stubGlobal('document', window.document)
    vi.stubGlobal('Element', window.Element)
    vi.stubGlobal('HTMLAnchorElement', window.HTMLAnchorElement)
    vi.stubGlobal('location', window.location)
    vi.stubGlobal('MouseEvent', window.MouseEvent)
    const root = document.createElement('main')
    document.body.append(root)
    const navigate = vi.fn()
    const uninstall = installPanelSpaNavigation(root, { exceptions: [], navigate, prefetching: false })
    const click = (href: string, configure?: (anchor: HTMLAnchorElement) => void, init?: MouseEventInit): MouseEvent => {
      const anchor = document.createElement('a')
      anchor.href = href
      configure?.(anchor)
      root.replaceChildren(anchor)
      const event = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true, ...init })
      anchor.dispatchEvent(event)
      return event
    }

    expect(click('/admin/categories').defaultPrevented).toBe(true)
    expect(navigate).toHaveBeenLastCalledWith('/admin/categories')
    expect(click('/admin/export', anchor => anchor.download = 'records.csv').defaultPrevented).toBe(false)
    expect(click('/admin/report', anchor => anchor.target = '_blank').defaultPrevented).toBe(false)
    expect(click('/admin/help', anchor => anchor.rel = 'external').defaultPrevented).toBe(false)
    expect(click('https://other.example/admin/posts').defaultPrevented).toBe(false)
    expect(click('/admin/posts', undefined, { metaKey: true }).defaultPrevented).toBe(false)
    expect(navigate).toHaveBeenCalledTimes(1)
    uninstall()
  })
})
