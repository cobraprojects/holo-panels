import { headers } from 'next/headers.js'
import { PanelRuntimeError, PageAccessError } from '@holo-js/panels-react/server'
import { NextPanelClient } from '@holo-js/panels-next/client'
import type { CreatePanelPageOptions, NextPanelPageProps } from './contracts'
import { NextPanelPageNotFoundError, resolveNextPanelPage, resolveNextPanelPath } from './runtime'

async function currentRequest(path: string): Promise<Request> {
  const source = await headers()
  const protocol = source.get('x-forwarded-proto') === 'http' ? 'http' : 'https'
  const host = source.get('x-forwarded-host') ?? source.get('host') ?? 'localhost'
  return new Request(`${protocol}://${host}${path}`, { headers: source })
}

function loginPath(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`
}

export function createPanelPage(options: CreatePanelPageOptions) {
  return async function GeneratedPanelPage({ params }: NextPanelPageProps) {
    const panelsPath = (await params).panelsPath ?? []
    const suffix = panelsPath.map(segment => encodeURIComponent(segment)).join('/')
    try {
      const panelPath = await resolveNextPanelPath(options.panelId, options.runtime)
      const tentativePath = `${panelPath === '/' ? '' : panelPath}${suffix ? `/${suffix}` : ''}` || '/'
      const request = await currentRequest(tentativePath)
      const payload = await resolveNextPanelPage(options.panelId, panelsPath, request, options.runtime)
      const Client = options.client ?? NextPanelClient
      return <Client payload={payload} />
    } catch (error) {
      const { forbidden, notFound, redirect } = await import('next/navigation.js')
      if (error instanceof NextPanelPageNotFoundError) notFound()
      if (error instanceof PageAccessError || error instanceof PanelRuntimeError && error.code === 'access-denied') forbidden()
      if (error instanceof PanelRuntimeError && error.code === 'panel-not-found') notFound()
      if (error instanceof PanelRuntimeError && error.code === 'unauthenticated') {
        const panelPath = await resolveNextPanelPath(options.panelId, options.runtime)
        const destination = `${panelPath === '/' ? '' : panelPath}${suffix ? `/${suffix}` : ''}` || '/'
        redirect(loginPath(destination))
      }
      throw error
    }
  }
}
