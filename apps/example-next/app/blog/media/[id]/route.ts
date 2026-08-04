import { createExampleBlogDomain } from '../../../../server/domain/blog'

interface BlogMediaRouteContext {
  readonly params: Promise<{ readonly id: string }>
}

const escapeXml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

export async function GET(_request: Request, context: BlogMediaRouteContext): Promise<Response> {
  const { id } = await context.params
  const media = createExampleBlogDomain().findPublicMedia('tenant-acme', id)
  if (!media) return new Response('Not found', { status: 404 })
  const label = escapeXml(media.alt)
  const body = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" viewBox="0 0 640 360"><rect width="640" height="360" fill="#111827"/><circle cx="160" cy="180" r="96" fill="#06b6d4"/><rect x="250" y="84" width="240" height="192" rx="32" fill="#8b5cf6"/><text x="320" y="324" fill="white" text-anchor="middle" font-family="sans-serif" font-size="24">${label}</text></svg>`
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
