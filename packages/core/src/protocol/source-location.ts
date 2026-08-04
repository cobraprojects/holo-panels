export interface SourceLocation {
  column?: number
  exportName: string
  line?: number
  projectPath: string
}

export interface PublicSourceLocation {
  column?: number
  exportName: string
  line?: number
  projectPath?: string
}

export function createSourceLocation(
  projectPath: string,
  exportName: string,
  line?: number,
  column?: number,
): SourceLocation {
  return {
    projectPath,
    exportName,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  }
}

export function exposeSourceLocation(
  location: SourceLocation,
  environment: 'development' | 'production',
): PublicSourceLocation {
  if (environment === 'production') {
    return {
      exportName: location.exportName,
    }
  }

  return { ...location }
}
