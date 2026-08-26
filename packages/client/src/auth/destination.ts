export function requestedPanelDestination(): string | null {
  const currentUrl = globalThis.location?.href
  if (!currentUrl) return null
  try {
    return new URL(currentUrl).searchParams.get('next')
  } catch {
    return null
  }
}
