export interface PanelSpaNavigationOptions {
  readonly exceptions: readonly string[]
  readonly navigate: (url: string) => void | Promise<void>
  readonly prefetching: boolean
}

export async function navigatePanelUrl(url: string, options: {
  readonly enabled: boolean
  readonly exceptions: readonly string[]
  readonly navigate: (url: string, replace: boolean) => void | Promise<void>
}, replace = false): Promise<void> {
  const target = new URL(url, globalThis.location.href)
  if (options.enabled && target.origin === globalThis.location.origin && !excluded(target, options.exceptions)) {
    await options.navigate(`${target.pathname}${target.search}${target.hash}`, replace)
    return
  }
  if (replace) globalThis.location.replace(url)
  else globalThis.location.assign(url)
}

function wildcardPattern(value: string): RegExp {
  const escaped = value.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&').replace(/\*/gu, '.*')
  return new RegExp(`^${escaped}$`, 'u')
}

function excluded(url: URL, exceptions: readonly string[]): boolean {
  return exceptions.some(value => {
    const pattern = wildcardPattern(value)
    return pattern.test(url.href) || pattern.test(`${url.pathname}${url.search}${url.hash}`)
  })
}

function anchorFromEvent(event: Event, root: HTMLElement): HTMLAnchorElement | null {
  const target = event.target
  if (!(target instanceof Element)) return null
  const anchor = target.closest<HTMLAnchorElement>('a[href]')
  return anchor && root.contains(anchor) ? anchor : null
}

function destination(anchor: HTMLAnchorElement, exceptions: readonly string[]): URL | null {
  if (anchor.hasAttribute('download') || anchor.relList.contains('external') || anchor.target && anchor.target !== '_self') return null
  const url = new URL(anchor.href, globalThis.location.href)
  if (url.hash || url.origin !== globalThis.location.origin || excluded(url, exceptions)) return null
  return url
}

function prefetch(url: URL): void {
  const href = `${url.pathname}${url.search}`
  const exists = [...document.head.querySelectorAll<HTMLLinkElement>('link[data-holo-panel-prefetch]')]
    .some(link => link.getAttribute('href') === href)
  if (exists) return
  const link = document.createElement('link')
  link.dataset.holoPanelPrefetch = ''
  link.href = href
  link.rel = 'prefetch'
  document.head.append(link)
}

export function installPanelSpaNavigation(root: HTMLElement, options: PanelSpaNavigationOptions): () => void {
  const click = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const anchor = anchorFromEvent(event, root)
    if (!anchor) return
    const url = destination(anchor, options.exceptions)
    if (!url) return
    event.preventDefault()
    void options.navigate(`${url.pathname}${url.search}${url.hash}`)
  }
  const hover = (event: MouseEvent): void => {
    if (!options.prefetching) return
    const anchor = anchorFromEvent(event, root)
    if (!anchor) return
    const url = destination(anchor, options.exceptions)
    if (url) prefetch(url)
  }
  root.addEventListener('click', click)
  root.addEventListener('mouseover', hover)
  return () => {
    root.removeEventListener('click', click)
    root.removeEventListener('mouseover', hover)
  }
}
