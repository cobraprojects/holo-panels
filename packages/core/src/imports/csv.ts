export interface CsvImportLimits {
  readonly maxBytes: number
  readonly maxCellBytes: number
  readonly maxColumns: number
  readonly maxRows: number
}

export interface CsvImportOptions {
  readonly delimiter?: string
  readonly headerOffset?: number
  readonly limits: CsvImportLimits
}

export interface ParsedCsvImport {
  readonly headers: readonly string[]
  readonly rows: readonly Readonly<Record<string, string>>[]
}

export type CsvImportErrorCode
  = 'duplicate_header'
    | 'empty_header'
    | 'invalid_delimiter'
    | 'invalid_encoding'
    | 'invalid_header_offset'
    | 'invalid_limits'
    | 'malformed_csv'
    | 'max_bytes_exceeded'
    | 'max_cell_bytes_exceeded'
    | 'max_columns_exceeded'
    | 'max_rows_exceeded'
    | 'missing_header'
    | 'row_width_mismatch'

export class CsvImportError extends Error {
  constructor(
    readonly code: CsvImportErrorCode,
    message: string,
    readonly row: number | null = null,
    readonly column: number | null = null,
  ) {
    super(message)
    this.name = 'CsvImportError'
  }
}

function fail(
  code: CsvImportErrorCode,
  message: string,
  row: number | null = null,
  column: number | null = null,
): never {
  throw new CsvImportError(code, message, row, column)
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) fail('invalid_limits', `${name} must be a positive safe integer`)
}

function validateOptions(options: CsvImportOptions): Required<Omit<CsvImportOptions, 'limits'>> & { readonly limits: CsvImportLimits } {
  const delimiter = options.delimiter ?? ','
  if ([...delimiter].length !== 1 || delimiter === '"' || delimiter === '\r' || delimiter === '\n' || delimiter.charCodeAt(0) <= 31) {
    fail('invalid_delimiter', 'CSV delimiter must be one printable character other than a quote')
  }
  const headerOffset = options.headerOffset ?? 0
  if (!Number.isSafeInteger(headerOffset) || headerOffset < 0) {
    fail('invalid_header_offset', 'CSV header offset must be a non-negative safe integer')
  }
  positiveInteger(options.limits.maxBytes, 'CSV maximum bytes')
  positiveInteger(options.limits.maxCellBytes, 'CSV maximum cell bytes')
  positiveInteger(options.limits.maxColumns, 'CSV maximum columns')
  positiveInteger(options.limits.maxRows, 'CSV maximum rows')
  return { delimiter, headerOffset, limits: options.limits }
}

function decodeCsv(input: string | Uint8Array, maxBytes: number): string {
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > maxBytes) fail('max_bytes_exceeded', 'CSV exceeds the maximum byte size')
    return input.replace(/^\uFEFF/u, '')
  }
  if (input.byteLength > maxBytes) fail('max_bytes_exceeded', 'CSV exceeds the maximum byte size')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input).replace(/^\uFEFF/u, '')
  } catch {
    return fail('invalid_encoding', 'CSV must be valid UTF-8')
  }
}

function parseRecords(source: string, delimiter: string, limits: CsvImportLimits): readonly (readonly string[])[] {
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let cellBytes = 0
  let column = 1
  let row = 1
  let index = 0
  let quoted = false
  let closedQuote = false

  const append = (character: string): void => {
    cell += character
    cellBytes += new TextEncoder().encode(character).byteLength
    if (cellBytes > limits.maxCellBytes) fail('max_cell_bytes_exceeded', 'CSV cell exceeds the maximum byte size', row, column)
  }
  const finishCell = (): void => {
    record.push(cell)
    if (record.length > limits.maxColumns) fail('max_columns_exceeded', 'CSV record exceeds the maximum column count', row, column)
    cell = ''
    cellBytes = 0
    column += 1
    closedQuote = false
  }
  const finishRecord = (): void => {
    finishCell()
    records.push(record)
    record = []
    row += 1
    column = 1
  }

  while (index < source.length) {
    const character = source[index]!
    if (quoted) {
      if (character !== '"') {
        append(character)
        index += 1
        continue
      }
      if (source[index + 1] === '"') {
        append('"')
        index += 2
        continue
      }
      quoted = false
      closedQuote = true
      index += 1
      continue
    }
    if (closedQuote && character !== delimiter && character !== '\r' && character !== '\n') {
      fail('malformed_csv', 'Unexpected content after a closing quote', row, column)
    }
    if (character === '"') {
      if (cell.length > 0 || closedQuote) fail('malformed_csv', 'Quotes must begin at the start of a CSV cell', row, column)
      quoted = true
      index += 1
      continue
    }
    if (character === delimiter) {
      finishCell()
      index += 1
      continue
    }
    if (character === '\r' || character === '\n') {
      finishRecord()
      index += character === '\r' && source[index + 1] === '\n' ? 2 : 1
      continue
    }
    append(character)
    index += 1
  }

  if (quoted) fail('malformed_csv', 'CSV contains an unterminated quoted cell', row, column)
  if (cell.length > 0 || record.length > 0 || closedQuote) finishRecord()
  return records
}

function headersAt(records: readonly (readonly string[])[], offset: number): readonly string[] {
  const header = records[offset]
  if (!header) fail('missing_header', 'CSV does not contain a header at the configured offset')
  const normalized = header.map(value => value.trim())
  const seen = new Set<string>()
  for (let index = 0; index < normalized.length; index += 1) {
    const value = normalized[index]!
    if (!value) fail('empty_header', 'CSV headers cannot be empty', offset + 1, index + 1)
    if (seen.has(value)) fail('duplicate_header', `CSV header "${value}" is duplicated`, offset + 1, index + 1)
    seen.add(value)
  }
  return Object.freeze(normalized)
}

export function parseCsvImport(input: string | Uint8Array, options: CsvImportOptions): ParsedCsvImport {
  const normalized = validateOptions(options)
  const records = parseRecords(decodeCsv(input, normalized.limits.maxBytes), normalized.delimiter, normalized.limits)
  const headers = headersAt(records, normalized.headerOffset)
  const data = records.slice(normalized.headerOffset + 1)
  if (data.length > normalized.limits.maxRows) fail('max_rows_exceeded', 'CSV exceeds the maximum data row count')
  const rows = data.map((values, index) => {
    if (values.length !== headers.length) {
      fail('row_width_mismatch', 'CSV row does not match the header width', normalized.headerOffset + index + 2)
    }
    return Object.freeze(Object.fromEntries(headers.map((header, column) => [header, values[column]!])))
  })
  return Object.freeze({ headers, rows: Object.freeze(rows) })
}

export async function parseCsvImportStream(
  chunks: AsyncIterable<Uint8Array>,
  options: CsvImportOptions,
  selection?: { readonly limit: number, readonly offset: number },
): Promise<ParsedCsvImport> {
  const normalized = validateOptions(options)
  if (selection && (!Number.isSafeInteger(selection.offset) || selection.offset < 0 || !Number.isSafeInteger(selection.limit) || selection.limit < 1)) {
    fail('invalid_limits', 'CSV row selection is invalid')
  }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const rows: Readonly<Record<string, string>>[] = []
  let headers: readonly string[] | null = null
  let record: string[] = []
  let cell = ''
  let cellBytes = 0
  let column = 1
  let recordNumber = 0
  let dataRows = 0
  let totalBytes = 0
  let quoted = false
  let closedQuote = false
  let quotePending = false
  let skipLineFeed = false
  let firstCharacter = true

  const append = (character: string): void => {
    cell += character
    cellBytes += new TextEncoder().encode(character).byteLength
    if (cellBytes > normalized.limits.maxCellBytes) fail('max_cell_bytes_exceeded', 'CSV cell exceeds the maximum byte size', recordNumber + 1, column)
  }
  const finishCell = (): void => {
    record.push(cell)
    if (record.length > normalized.limits.maxColumns) fail('max_columns_exceeded', 'CSV record exceeds the maximum column count', recordNumber + 1, column)
    cell = ''
    cellBytes = 0
    column += 1
    closedQuote = false
  }
  const finishRecord = (): void => {
    finishCell()
    recordNumber += 1
    if (recordNumber === normalized.headerOffset + 1) {
      headers = headersAt([record], 0)
    } else if (recordNumber > normalized.headerOffset + 1) {
      if (!headers) fail('missing_header', 'CSV does not contain a header at the configured offset')
      dataRows += 1
      if (dataRows > normalized.limits.maxRows) fail('max_rows_exceeded', 'CSV exceeds the maximum data row count')
      if (record.length !== headers.length) fail('row_width_mismatch', 'CSV row does not match the header width', recordNumber)
      const offset = selection?.offset ?? 0
      const limit = selection?.limit ?? normalized.limits.maxRows
      if (dataRows > offset && rows.length < limit) rows.push(Object.freeze(Object.fromEntries(headers.map((header, index) => [header, record[index]!]))))
    }
    record = []
    column = 1
  }
  const consume = (source: string): void => {
    for (const original of source) {
      if (firstCharacter) {
        firstCharacter = false
        if (original === '\uFEFF') continue
      }
      if (skipLineFeed) {
        skipLineFeed = false
        if (original === '\n') continue
      }
      if (quoted) {
        if (quotePending) {
          if (original === '"') {
            append('"')
            quotePending = false
            continue
          }
          quoted = false
          closedQuote = true
          quotePending = false
        } else if (original === '"') {
          quotePending = true
          continue
        } else {
          append(original)
          continue
        }
      }
      if (closedQuote && original !== normalized.delimiter && original !== '\r' && original !== '\n') fail('malformed_csv', 'Unexpected content after a closing quote', recordNumber + 1, column)
      if (original === '"') {
        if (cell.length > 0 || closedQuote) fail('malformed_csv', 'Quotes must begin at the start of a CSV cell', recordNumber + 1, column)
        quoted = true
      } else if (original === normalized.delimiter) {
        finishCell()
      } else if (original === '\r' || original === '\n') {
        finishRecord()
        skipLineFeed = original === '\r'
      } else {
        append(original)
      }
    }
  }

  try {
    for await (const chunk of chunks) {
      if (chunk.byteLength === 0) fail('malformed_csv', 'CSV stream contains an empty chunk')
      totalBytes += chunk.byteLength
      if (totalBytes > normalized.limits.maxBytes) fail('max_bytes_exceeded', 'CSV exceeds the maximum byte size')
      consume(decoder.decode(chunk, { stream: true }))
    }
    consume(decoder.decode())
  } catch (error) {
    if (error instanceof CsvImportError) throw error
    fail('invalid_encoding', 'CSV must be valid UTF-8')
  }
  if (quoted && !quotePending) fail('malformed_csv', 'CSV contains an unterminated quoted cell', recordNumber + 1, column)
  if (quotePending) {
    quoted = false
    closedQuote = true
  }
  if (cell.length > 0 || record.length > 0 || closedQuote) finishRecord()
  if (!headers) fail('missing_header', 'CSV does not contain a header at the configured offset')
  return Object.freeze({ headers, rows: Object.freeze(rows) })
}
