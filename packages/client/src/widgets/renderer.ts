export function widgetExtensionRendererName(type: string): string | null {
  return type.includes(':widget:') ? `widget.${type.replaceAll(':', '.')}` : null
}
