export interface DiscoveryErrorLocation {
  readonly path: string
  readonly exportName?: string
}

export class PanelsDiscoveryError extends Error {
  readonly code: string
  readonly location?: DiscoveryErrorLocation

  constructor(code: string, message: string, location?: DiscoveryErrorLocation) {
    super(location
      ? `${message} (${location.path}${location.exportName ? `#${location.exportName}` : ''})`
      : message)
    this.name = 'PanelsDiscoveryError'
    this.code = code
    this.location = location
  }
}
