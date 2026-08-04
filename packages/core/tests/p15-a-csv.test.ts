import { describe, expect, it } from 'vitest'
import { type CsvImportError, parseCsvImport, parseCsvImportStream } from '../src/imports/csv'

const limits = {
  maxBytes: 1_024,
  maxCellBytes: 64,
  maxColumns: 4,
  maxRows: 3,
}

describe('P15-A CSV parsing', () => {
  it('preserves UTF-8 and quoted CSV state across bounded storage chunks', async () => {
    const encoded = new TextEncoder().encode('name,note\r\nAda,"said ""hello"""\r\nLin,"line 1\nline 2"')
    const chunks = async function * (): AsyncGenerator<Uint8Array> {
      for (let offset = 0; offset < encoded.length; offset += 3) yield encoded.slice(offset, offset + 3)
    }
    await expect(parseCsvImportStream(chunks(), { limits })).resolves.toEqual({
      headers: ['name', 'note'],
      rows: [{ name: 'Ada', note: 'said "hello"' }, { name: 'Lin', note: 'line 1\nline 2' }],
    })
  })

  it('parses UTF-8, quoted fields, embedded newlines, delimiters, and a header offset', () => {
    const result = parseCsvImport('\uFEFFmetadata\r\nname;note\r\nAda;"line 1\nline; 2"\r\nLin;"said ""hello"""', {
      delimiter: ';',
      headerOffset: 1,
      limits,
    })

    expect(result).toEqual({
      headers: ['name', 'note'],
      rows: [
        { name: 'Ada', note: 'line 1\nline; 2' },
        { name: 'Lin', note: 'said "hello"' },
      ],
    })
    expect(Object.isFrozen(result.rows[0])).toBe(true)
  })

  it('rejects malformed UTF-8 and quoting', () => {
    expect(() => parseCsvImport(new Uint8Array([0xc3, 0x28]), { limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'invalid_encoding' }),
    )
    expect(() => parseCsvImport('name\n"unfinished', { limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'malformed_csv', row: 2, column: 1 }),
    )
    expect(() => parseCsvImport('name\n"closed"suffix', { limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'malformed_csv', row: 2, column: 1 }),
    )
  })

  it('rejects ambiguous headers and mismatched rows', () => {
    expect(() => parseCsvImport('name,name\nAda,Lovelace', { limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'duplicate_header' }),
    )
    expect(() => parseCsvImport('name,email\nAda', { limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'row_width_mismatch', row: 2 }),
    )
  })

  it.each([
    ['max_bytes_exceeded', 'name\nAda', { ...limits, maxBytes: 4 }],
    ['max_cell_bytes_exceeded', 'name\nAda', { ...limits, maxCellBytes: 2 }],
    ['max_columns_exceeded', 'a,b,c\n1,2,3', { ...limits, maxColumns: 2 }],
    ['max_rows_exceeded', 'name\n1\n2', { ...limits, maxRows: 1 }],
  ] as const)('enforces %s before returning untrusted data', (code, input, constrained) => {
    expect(() => parseCsvImport(input, { limits: constrained })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code }),
    )
  })

  it('requires a valid header offset and safe delimiter', () => {
    expect(() => parseCsvImport('name\nAda', { headerOffset: 3, limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'missing_header' }),
    )
    expect(() => parseCsvImport('name\nAda', { delimiter: '||', limits })).toThrowError(
      expect.objectContaining<Partial<CsvImportError>>({ code: 'invalid_delimiter' }),
    )
  })
})
