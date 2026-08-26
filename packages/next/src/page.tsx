import { headers } from 'next/headers.js'
import { PanelRuntimeError, PanelSubscriptionRequiredError, PageAccessError } from '@holo-js/panels-react/server'
import { NextPanelClient } from '@holo-js/panels-next/client'
import type { CreatePanelPageOptions, NextPanelPageProps } from './contracts'
import { NextPanelPageNotFoundError, resolveNextPanelBillingResponse, resolveNextPanelLoginPath, resolveNextPanelPage, resolveNextPanelPath } from './runtime'

function requestQuery(searchParams: Readonly<Record<string, string | readonly string[] | undefined>>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') query.append(key, value)
    else if (value) for (const item of value) query.append(key, item)
  }
  return query.toString()
}

async function currentRequest(path: string, serializedQuery: string): Promise<Request> {
  const source = await headers()
  const protocol = source.get('x-forwarded-proto') === 'http' ? 'http' : 'https'
  const host = source.get('x-forwarded-host') ?? source.get('host') ?? 'localhost'
  return new Request(`${protocol}://${host}${path}${serializedQuery ? `?${serializedQuery}` : ''}`, { headers: source })
}

function loginDestination(loginPath: string, path: string): string {
  return `${loginPath}?next=${encodeURIComponent(path)}`
}

export function createPanelPage(options: CreatePanelPageOptions) {
  return async function GeneratedPanelPage({ params, searchParams }: NextPanelPageProps) {
    const panelsPath = (await params).panelsPath ?? []
    const query = await searchParams ?? {}
    const serializedQuery = requestQuery(query)
    const suffix = panelsPath.map(segment => encodeURIComponent(segment)).join('/')
    try {
      const panelPath = await resolveNextPanelPath(options.panelId, options.runtime)
      const tentativePath = `${panelPath === '/' ? '' : panelPath}${suffix ? `/${suffix}` : ''}` || '/'
      const request = await currentRequest(tentativePath, serializedQuery)
      const billing = await resolveNextPanelBillingResponse(options.panelId, panelsPath, request, options.runtime)
      if (billing) {
        const { redirect } = await import('next/navigation.js')
        const location = billing.headers.get('location')
        if (location && billing.status >= 300 && billing.status < 400) redirect(location)
        if (!billing.ok) throw new Error('The tenant billing provider rejected the billing route request')
        return <div data-panel-billing-response="">{await billing.text()}</div>
      }
      const payload = await resolveNextPanelPage(options.panelId, panelsPath, request, options.runtime)
      const Client = options.client ?? NextPanelClient
      return <Client payload={payload} />
    } catch (error) {
      const { forbidden, notFound, redirect } = await import('next/navigation.js')
      if (error instanceof NextPanelPageNotFoundError) notFound()
      if (error instanceof PageAccessError || error instanceof PanelRuntimeError && error.code === 'access-denied') forbidden()
      if (error instanceof PanelRuntimeError && error.code === 'panel-not-found') notFound()
      if (error instanceof PanelSubscriptionRequiredError) redirect(error.billingPath)
      if (error instanceof PanelRuntimeError && error.code === 'unauthenticated') {
        const panelPath = await resolveNextPanelPath(options.panelId, options.runtime)
        const destinationPath = `${panelPath === '/' ? '' : panelPath}${suffix ? `/${suffix}` : ''}` || '/'
        const destination = `${destinationPath}${serializedQuery ? `?${serializedQuery}` : ''}`
        redirect(loginDestination(await resolveNextPanelLoginPath(options.panelId, options.runtime), destination))
      }
      throw error
    }
  }
}
