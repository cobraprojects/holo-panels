import { parseCsvImportStream } from '../imports/csv'
import { writeCsvExport } from '../exports/csv'
import { writeXlsxExport } from './xlsx'
import type {
  CsvExportOptions,
  CsvImportOptions,
  ExportCell,
  ExportFormatInput,
  ExportFormatAdapter,
  ImportFormatAdapter,
  TransferArtifactWriter,
  TransferInputSource,
  XlsxExportOptions,
} from './contracts'

const encoder = new TextEncoder()
const defaultImportOptions: CsvImportOptions = Object.freeze({
  limits: Object.freeze({
    maxBytes: 10_485_760,
    maxCellBytes: 1_048_576,
    maxColumns: 500,
    maxRows: 100_000,
  }),
})

function exportCell(value: ExportCell): boolean | number | string | null {
  return value instanceof Date ? value.toISOString() : value
}

export function csvImportFormat(defaults: CsvImportOptions = defaultImportOptions): ImportFormatAdapter<CsvImportOptions> {
  const adapter: ImportFormatAdapter<CsvImportOptions> = {
    id: 'csv',
    async inspect(source: TransferInputSource, options: CsvImportOptions) {
      const parsed = await parseCsvImportStream(source.chunks(), { ...defaults, ...options })
      return Object.freeze({ headers: parsed.headers, rows: parsed.rows.length })
    },
    label: 'CSV',
    async readChunk(source: TransferInputSource, options: CsvImportOptions, offset: number, limit: number) {
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1) {
        throw new Error('[Holo Panels] CSV chunk bounds are invalid.')
      }
      const parsed = await parseCsvImportStream(source.chunks(), { ...defaults, ...options }, { limit, offset })
      return parsed.rows
    },
  }
  return Object.freeze(adapter)
}

export function csvExportFormat(defaults: CsvExportOptions = {}): ExportFormatAdapter<CsvExportOptions> {
  const adapter: ExportFormatAdapter<CsvExportOptions> = {
    artifact: Object.freeze({ contentType: 'text/csv; charset=utf-8', extension: 'csv', filename: 'export.csv' }),
    id: 'csv',
    label: 'CSV',
    async write(input: ExportFormatInput, output: TransferArtifactWriter, options: CsvExportOptions) {
      try {
        await output.write(encoder.encode(writeCsvExport({ headers: input.headers, rows: [] }, { ...defaults, ...options })))
        const lineEnding = options.lineEnding ?? defaults.lineEnding ?? '\r\n'
        for await (const chunk of input.rows) {
          if (chunk.length === 0) continue
          const serialized = writeCsvExport(
            { headers: input.headers, rows: chunk.map(row => row.map(exportCell)) },
            { ...defaults, ...options },
          )
          const headerEnd = serialized.indexOf(lineEnding)
          await output.write(encoder.encode(serialized.slice(headerEnd + lineEnding.length)))
        }
        await output.close()
      } catch (error) {
        await output.abort()
        throw error
      }
    },
  }
  return Object.freeze(adapter)
}

export function xlsxExportFormat(defaults: XlsxExportOptions = {}): ExportFormatAdapter<XlsxExportOptions> {
  const adapter: ExportFormatAdapter<XlsxExportOptions> = {
    artifact: Object.freeze({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      filename: 'export.xlsx',
    }),
    id: 'xlsx',
    label: 'XLSX',
    write: (input, output, options) => writeXlsxExport(input, output, { ...defaults, ...options }),
  }
  return Object.freeze(adapter)
}
