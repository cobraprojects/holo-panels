import { describe, expect, it } from 'vitest'
import { type CsvExportError, escapeSpreadsheetFormula, writeCsvExport } from '../src/exports/csv'

describe('P15-B CSV exports', () => {
  it('escapes formula-capable untrusted text by default', () => {
    expect(['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tformula', '\rformula'].map(escapeSpreadsheetFormula)).toEqual([
      "'=1+1",
      "'+cmd",
      "'-2+3",
      "'@SUM(A1)",
      "'\tformula",
      "'\rformula",
    ])
    expect(writeCsvExport({ headers: ['value'], rows: [['=HYPERLINK("https://example.test")']] })).toBe(
      'value\r\n"\'=HYPERLINK(""https://example.test"")"\r\n',
    )
  })

  it('serializes scalar values and RFC-compatible quoting deterministically', () => {
    expect(writeCsvExport({
      headers: ['name', 'note', 'active', 'score', 'empty'],
      rows: [['Ada', 'line 1\nline, 2', true, 4.5, null]],
    })).toBe('name,note,active,score,empty\r\nAda,"line 1\nline, 2",true,4.5,\r\n')
  })

  it('supports an explicit safe delimiter, line ending, and formula opt-out', () => {
    expect(writeCsvExport(
      { headers: ['value', 'other'], rows: [['=trusted()', 'a;b']] },
      { delimiter: ';', escapeFormulas: false, lineEnding: '\n' },
    )).toBe('value;other\n=trusted();"a;b"\n')
  })

  it('rejects invalid delimiters, headers, and row widths', () => {
    expect(() => writeCsvExport({ headers: ['value'], rows: [] }, { delimiter: '||' })).toThrowError(
      expect.objectContaining<Partial<CsvExportError>>({ code: 'invalid_delimiter' }),
    )
    expect(() => writeCsvExport({ headers: [], rows: [] })).toThrowError(
      expect.objectContaining<Partial<CsvExportError>>({ code: 'invalid_header' }),
    )
    expect(() => writeCsvExport({ headers: ['one', 'two'], rows: [['only one']] })).toThrowError(
      expect.objectContaining<Partial<CsvExportError>>({ code: 'row_width_mismatch', row: 1 }),
    )
  })
})
