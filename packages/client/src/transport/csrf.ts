import { getSecurityClientConfig } from '@holo-js/security/client'

export type ClientCsrfField = {
  readonly name: string
  readonly value: string
}

export interface ClientCsrfProvider {
  getField(): ClientCsrfField | undefined
}

type BrowserRuntime = typeof globalThis & {
  readonly document?: {
    readonly cookie?: string
  }
}

function decodeCookiePart(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=')
    if (separator <= 0) continue
    const candidateName = decodeCookiePart(segment.slice(0, separator).trim())
    if (candidateName !== name) continue
    return decodeCookiePart(segment.slice(separator + 1))
  }
  return undefined
}

export class HoloSecurityCsrfProvider implements ClientCsrfProvider {
  getField(): ClientCsrfField | undefined {
    const runtime = globalThis as BrowserRuntime
    const cookieHeader = runtime.document?.cookie
    if (typeof cookieHeader !== 'string') return undefined
    const config = getSecurityClientConfig().csrf
    const value = readCookie(cookieHeader, config.cookie)
    if (!value) return undefined
    return Object.freeze({ name: config.field, value })
  }
}

export const csrfInternals = Object.freeze({ readCookie })
