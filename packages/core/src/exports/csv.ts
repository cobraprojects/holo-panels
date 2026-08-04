export type CsvExportCell = boolean | number | string | null

export interface CsvExportOptions {
  readonly delimiter?: string
  readonly escapeFormulas?: boolean
  readonly lineEnding?: '\n' | '\r\n'
}

export interface CsvExportInput {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly CsvExportCell[])[]
}

export type CsvExportErrorCode = 'invalid_delimiter' | 'invalid_header' | 'row_width_mismatch'

export class CsvExportError extends Error {
  constructor(readonly code: CsvExportErrorCode, message: string, readonly row: number | null = null) {
    super(message)
    this.name = 'CsvExportError'
  }
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/u

function delimiter(value: string | undefined): string {
  const candidate = value ?? ','
  if ([...candidate].length !== 1 || candidate === '"' || candidate === '\r' || candidate === '\n' || candidate.charCodeAt(0) <= 31) {
    throw new CsvExportError('invalid_delimiter', 'CSV delimiter must be one printable character other than a quote')
  }
  return candidate
}

export function escapeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

function serializeCell(value: CsvExportCell, separator: string, escapeFormulas: boolean): string {
  const text = typeof value === 'string'
    ? escapeFormulas ? escapeSpreadsheetFormula(value) : value
    : value === null ? '' : String(value)
  if (text.includes('"') || text.includes(separator) || text.includes('\r') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function writeCsvExport(input: CsvExportInput, options: CsvExportOptions = {}): string {
  const separator = delimiter(options.delimiter)
  const lineEnding = options.lineEnding ?? '\r\n'
  const escapeFormulas = options.escapeFormulas ?? true
  if (input.headers.length === 0 || input.headers.some(header => header.length === 0)) {
    throw new CsvExportError('invalid_header', 'CSV exports require non-empty headers')
  }
  const records: string[] = [input.headers.map(header => serializeCell(header, separator, escapeFormulas)).join(separator)]
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index]!
    if (row.length !== input.headers.length) {
      throw new CsvExportError('row_width_mismatch', 'CSV export row does not match the header width', index + 1)
    }
    records.push(row.map(value => serializeCell(value, separator, escapeFormulas)).join(separator))
  }
  return `${records.join(lineEnding)}${lineEnding}`
}
