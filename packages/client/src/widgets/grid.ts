import type { WidgetClientManifest, WidgetGridPlacement, WidgetViewport } from './contracts'

export function widgetViewport(width: number): WidgetViewport {
  if (!Number.isFinite(width) || width < 0) throw new Error('Widget viewport widths must be non-negative numbers')
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function widgetGridColumns(viewport: WidgetViewport): number {
  if (viewport === 'mobile') return 1
  if (viewport === 'tablet') return 2
  return 4
}

export function resolveWidgetGrid(manifests: readonly WidgetClientManifest[], width: number): readonly WidgetGridPlacement[] {
  const columns = widgetGridColumns(widgetViewport(width))
  return manifests.map(manifest => {
    const requestedSpan = manifest.layout.columnSpan === 'full' ? columns : manifest.layout.columnSpan
    if (!Number.isSafeInteger(requestedSpan) || requestedSpan < 1) throw new Error(`Widget ${manifest.id} requires a positive column span`)
    const columnSpan = Math.min(requestedSpan, columns)
    const requestedStart = manifest.layout.columnStart
    const columnStart = requestedStart !== null && requestedStart + columnSpan - 1 <= columns ? requestedStart : null
    if (requestedStart !== null && (!Number.isSafeInteger(requestedStart) || requestedStart < 1)) throw new Error(`Widget ${manifest.id} requires a positive start column`)
    return { columnSpan, columnStart, columns, widgetId: manifest.id }
  })
}
