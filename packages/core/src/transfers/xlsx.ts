import type { ExportCell, ExportFormatInput, TransferArtifactWriter, XlsxExportOptions } from './contracts'

const encoder = new TextEncoder()
const maximumColumns = 16_384
const maximumRows = 1_048_576

interface ZipEntry {
  readonly name: string
  readonly value: AsyncIterable<Uint8Array> | Uint8Array
}

interface ZipDirectoryEntry {
  readonly checksum: number
  readonly name: Uint8Array
  readonly offset: number
  readonly size: number
}

function assertSheetName(value: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 31 || /[\\/*?:[\]]/u.test(normalized)) throw new Error('[Holo Panels] XLSX sheet names must contain 1 to 31 valid characters.')
  return normalized
}

function assertDateFormat(value: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 255) throw new Error('[Holo Panels] XLSX date formats must contain 1 to 255 characters.')
  return normalized
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function columnName(index: number): string {
  let value = index + 1
  let result = ''
  while (value > 0) {
    value--
    result = String.fromCharCode(65 + value % 26) + result
    value = Math.floor(value / 26)
  }
  return result
}

function cellReference(column: number, row: number): string { return `${columnName(column)}${row}` }

function inlineString(reference: string, value: string): string {
  const space = /^\s|\s$/u.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" t="inlineStr"><is><t${space}>${escapeXml(value)}</t></is></c>`
}

function serializeCell(reference: string, value: ExportCell): string {
  if (value === null) return `<c r="${reference}"/>`
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('[Holo Panels] XLSX exports cannot contain invalid dates.')
    return `<c r="${reference}" s="1"><v>${value.getTime() / 86_400_000 + 25_569}</v></c>`
  }
  if (typeof value === 'boolean') return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('[Holo Panels] XLSX exports cannot contain non-finite numbers.')
    return `<c r="${reference}"><v>${value}</v></c>`
  }
  return inlineString(reference, value)
}

function serializeRow(values: readonly ExportCell[], row: number): string {
  return `<row r="${row}">${values.map((value, column) => serializeCell(cellReference(column, row), value)).join('')}</row>`
}

function write16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true) }
function write32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value >>> 0, true) }

function xml(value: string): Uint8Array { return encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${value}`) }

async function * worksheet(input: ExportFormatInput): AsyncIterable<Uint8Array> {
  if (input.headers.length === 0 || input.headers.length > maximumColumns) throw new Error(`[Holo Panels] XLSX exports require 1 to ${maximumColumns} columns.`)
  yield xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${serializeRow(input.headers, 1)}`)
  let rowNumber = 1
  for await (const chunk of input.rows) {
    for (const row of chunk) {
      rowNumber++
      if (rowNumber > maximumRows) throw new Error(`[Holo Panels] XLSX exports cannot exceed ${maximumRows} rows.`)
      if (row.length !== input.headers.length) throw new Error('[Holo Panels] XLSX rows must match the header column count.')
      yield encoder.encode(serializeRow(row, rowNumber))
    }
  }
  yield encoder.encode('</sheetData></worksheet>')
}

function localHeader(name: Uint8Array): Uint8Array {
  const header = new Uint8Array(30 + name.length)
  const view = new DataView(header.buffer)
  write32(view, 0, 0x04034b50)
  write16(view, 4, 20)
  write16(view, 6, 0x0808)
  write16(view, 8, 0)
  write16(view, 26, name.length)
  header.set(name, 30)
  return header
}

function descriptor(checksum: number, size: number): Uint8Array {
  const value = new Uint8Array(16)
  const view = new DataView(value.buffer)
  write32(view, 0, 0x08074b50)
  write32(view, 4, checksum)
  write32(view, 8, size)
  write32(view, 12, size)
  return value
}

function directoryEntry(entry: ZipDirectoryEntry): Uint8Array {
  const value = new Uint8Array(46 + entry.name.length)
  const view = new DataView(value.buffer)
  write32(view, 0, 0x02014b50)
  write16(view, 4, 20)
  write16(view, 6, 20)
  write16(view, 8, 0x0808)
  write16(view, 10, 0)
  write32(view, 16, entry.checksum)
  write32(view, 20, entry.size)
  write32(view, 24, entry.size)
  write16(view, 28, entry.name.length)
  write32(view, 42, entry.offset)
  value.set(entry.name, 46)
  return value
}

function archiveEnd(entries: number, directorySize: number, directoryOffset: number): Uint8Array {
  const value = new Uint8Array(22)
  const view = new DataView(value.buffer)
  write32(view, 0, 0x06054b50)
  write16(view, 8, entries)
  write16(view, 10, entries)
  write32(view, 12, directorySize)
  write32(view, 16, directoryOffset)
  return value
}

function crc32(checksum: number, bytes: Uint8Array): number {
  let value = checksum
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return value >>> 0
}

async function writeChunk(output: TransferArtifactWriter, bytes: Uint8Array): Promise<void> {
  for (let offset = 0; offset < bytes.length; offset += 65_536) await output.write(bytes.slice(offset, offset + 65_536))
}

async function writeArchive(entries: readonly ZipEntry[], output: TransferArtifactWriter): Promise<void> {
  const directory: ZipDirectoryEntry[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const header = localHeader(name)
    await writeChunk(output, header)
    const entryOffset = offset
    offset += header.length
    let checksum = 0xffffffff
    let size = 0
    const source = entry.value instanceof Uint8Array ? one(entry.value) : entry.value
    for await (const chunk of source) {
      checksum = crc32(checksum, chunk)
      size += chunk.length
      await writeChunk(output, chunk)
      offset += chunk.length
    }
    checksum = (checksum ^ 0xffffffff) >>> 0
    const footer = descriptor(checksum, size)
    await writeChunk(output, footer)
    offset += footer.length
    directory.push({ checksum, name, offset: entryOffset, size })
  }
  const directoryOffset = offset
  for (const entry of directory) {
    const value = directoryEntry(entry)
    await writeChunk(output, value)
    offset += value.length
  }
  await writeChunk(output, archiveEnd(directory.length, offset - directoryOffset, directoryOffset))
}

async function * one(value: Uint8Array): AsyncIterable<Uint8Array> { yield value }

export async function writeXlsxExport(input: ExportFormatInput, output: TransferArtifactWriter, options: XlsxExportOptions): Promise<void> {
  const sheetName = assertSheetName(options.sheetName ?? 'Export')
  const dateFormat = assertDateFormat(options.dateFormat ?? 'yyyy-mm-dd hh:mm:ss')
  try {
    await writeArchive([
      { name: '[Content_Types].xml', value: xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
      { name: '_rels/.rels', value: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', value: xml(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
      { name: 'xl/_rels/workbook.xml.rels', value: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', value: xml(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="${escapeXml(dateFormat)}"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`) },
      { name: 'xl/worksheets/sheet1.xml', value: worksheet(input) },
    ], output)
    await output.close()
  } catch (error) {
    await output.abort()
    throw error
  }
}
