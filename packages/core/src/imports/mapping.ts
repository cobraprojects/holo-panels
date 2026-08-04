export type ImportValues = Readonly<Record<string, unknown>>

export interface ImportColumnContext<TContext> {
  readonly context: TContext
  readonly row: number
}

export interface ImportColumnDefinition<TContext> {
  readonly key: string
  readonly required: boolean
  parse(value: string, context: ImportColumnContext<TContext>): unknown | Promise<unknown>
  resolve?(value: unknown, context: ImportColumnContext<TContext>): unknown | Promise<unknown>
}

export interface ImportColumnMapping {
  readonly column: string
  readonly header: string
}

export type ImportMappingErrorCode
  = 'duplicate_column'
    | 'duplicate_header'
    | 'duplicate_mapping'
    | 'invalid_column'
    | 'invalid_header'
    | 'missing_required_mapping'
    | 'unknown_column'
    | 'unknown_header'

export class ImportMappingError extends Error {
  constructor(
    readonly code: ImportMappingErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImportMappingError'
  }
}

export interface CompiledImportMapping<TContext> {
  map(
    source: Readonly<Record<string, string>>,
    context: ImportColumnContext<TContext>,
  ): Promise<ImportValues>
}

function uniqueNames(values: readonly string[], invalidCode: 'invalid_column' | 'invalid_header', duplicateCode: 'duplicate_column' | 'duplicate_header'): Set<string> {
  const names = new Set<string>()
  for (const value of values) {
    if (!value || value.trim() !== value) throw new ImportMappingError(invalidCode, 'Import mapping names must be non-empty and cannot contain surrounding whitespace')
    if (names.has(value)) throw new ImportMappingError(duplicateCode, `Import mapping name "${value}" is duplicated`)
    names.add(value)
  }
  return names
}

export function compileImportMapping<TContext>(
  headers: readonly string[],
  columns: readonly ImportColumnDefinition<TContext>[],
  mappings: readonly ImportColumnMapping[],
): CompiledImportMapping<TContext> {
  const availableHeaders = uniqueNames(headers, 'invalid_header', 'duplicate_header')
  const availableColumns = uniqueNames(columns.map(column => column.key), 'invalid_column', 'duplicate_column')
  const mappedHeaders = new Set<string>()
  const mappedColumns = new Set<string>()

  for (const mapping of mappings) {
    if (!availableHeaders.has(mapping.header)) throw new ImportMappingError('unknown_header', `Import header "${mapping.header}" is not available`)
    if (!availableColumns.has(mapping.column)) throw new ImportMappingError('unknown_column', `Import column "${mapping.column}" is not defined`)
    if (mappedHeaders.has(mapping.header) || mappedColumns.has(mapping.column)) {
      throw new ImportMappingError('duplicate_mapping', 'Each import header and column can be mapped only once')
    }
    mappedHeaders.add(mapping.header)
    mappedColumns.add(mapping.column)
  }

  for (const column of columns) {
    if (column.required && !mappedColumns.has(column.key)) {
      throw new ImportMappingError('missing_required_mapping', `Required import column "${column.key}" is not mapped`)
    }
  }

  const columnsByKey = new Map(columns.map(column => [column.key, column]))
  const compiled = mappings.map(mapping => {
    const column = columnsByKey.get(mapping.column)!
    return Object.freeze({
      header: mapping.header,
      key: column.key,
      parse: column.parse,
      resolve: column.resolve,
    })
  })

  return Object.freeze({
    async map(
      source: Readonly<Record<string, string>>,
      context: ImportColumnContext<TContext>,
    ): Promise<ImportValues> {
      const values: Record<string, unknown> = {}
      for (const entry of compiled) {
        if (!Object.hasOwn(source, entry.header)) {
          throw new ImportMappingError('unknown_header', `Import row does not contain mapped header "${entry.header}"`)
        }
        const parsed = await entry.parse(source[entry.header]!, context)
        values[entry.key] = entry.resolve
          ? await entry.resolve(parsed, context)
          : parsed
      }
      return Object.freeze(values)
    },
  })
}
