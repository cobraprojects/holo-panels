import type { ExporterManifest, ImporterManifest } from '@holo-js/panels-core'
import type { ClientUploadFile } from '../uploads'
import type { TableSelectionPayload, TableRecordId } from '../tables'

export type ClientTransferManifest = Readonly<ExporterManifest | ImporterManifest>

export interface ClientImportColumnMapping {
  readonly column: string
  readonly header: string
}

export interface ClientImportInspection {
  readonly headers: readonly string[]
  readonly uploadId: string
}

export interface ClientTransferProgress {
  readonly completed: number
  readonly operationId: string
  readonly status: 'completed' | 'failed' | 'queued' | 'running'
  readonly total: number
}

export interface ClientImportStartRequest {
  readonly definitionId: string
  readonly formatId: string
  readonly mappings: readonly ClientImportColumnMapping[]
  readonly uploadId: string
}

export interface ClientExportStartRequest<TRecordId extends TableRecordId = TableRecordId> {
  readonly columnIds: readonly string[]
  readonly definitionId: string
  readonly formatId: string
  readonly selection: TableSelectionPayload<TRecordId>
}

export interface ClientTransferTransport {
  inspectImport(request: { readonly definitionId: string, readonly file: ClientUploadFile }, signal: AbortSignal, onProgress: (progress: number) => void): Promise<ClientImportInspection>
  startExport(request: ClientExportStartRequest, signal: AbortSignal): Promise<ClientTransferProgress>
  startImport(request: ClientImportStartRequest, signal: AbortSignal): Promise<ClientTransferProgress>
}

export interface ClientTransferState {
  readonly error: string | null
  readonly inspection: ClientImportInspection | null
  readonly progress: ClientTransferProgress | null
  readonly uploadProgress: number
  readonly version: number
}

export type ClientTransferStateListener = (state: ClientTransferState) => void

function initialState(): ClientTransferState {
  return Object.freeze({ error: null, inspection: null, progress: null, uploadProgress: 0, version: 0 })
}

function assertIdentifier(value: string, available: readonly string[], label: string): void {
  if (!available.includes(value)) throw new Error(`[Holo Panels] Unknown ${label} "${value}".`)
}

export class ClientTransferStore {
  readonly #listeners = new Set<ClientTransferStateListener>()
  readonly #manifest: ClientTransferManifest
  readonly #transport: ClientTransferTransport
  #controller: AbortController | null = null
  #state = initialState()

  constructor(manifest: ClientTransferManifest, transport: ClientTransferTransport) {
    this.#manifest = manifest
    this.#transport = transport
  }

  get state(): ClientTransferState {
    return this.#state
  }

  subscribe(listener: ClientTransferStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async inspect(file: ClientUploadFile): Promise<ClientImportInspection> {
    if (this.#manifest.kind !== 'import') throw new Error('[Holo Panels] Only import actions accept uploads.')
    if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('[Holo Panels] Import files must use the CSV extension.')
    if (file.type && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') throw new Error('[Holo Panels] Import files must use an allowed CSV MIME type.')
    if (file.size <= 0 || file.size > this.#manifest.maxFileBytes) throw new Error('[Holo Panels] Import file size is outside the configured limit.')
    this.cancel()
    const controller = new AbortController()
    this.#controller = controller
    try {
      const inspection = await this.#transport.inspectImport({ definitionId: this.#manifest.id, file }, controller.signal, progress => this.publish({ uploadProgress: Math.min(100, Math.max(0, progress)) }))
      if (new Set(inspection.headers).size !== inspection.headers.length || inspection.headers.some(header => !header.trim())) throw new Error('[Holo Panels] Import inspection returned invalid headers.')
      this.publish({ error: null, inspection, uploadProgress: 100 })
      return inspection
    } catch (cause) {
      this.publish({ error: cause instanceof Error ? cause.message : 'Import inspection failed' })
      throw cause
    } finally {
      if (this.#controller === controller) this.#controller = null
    }
  }

  async startImport(formatId: string, mappings: readonly ClientImportColumnMapping[]): Promise<ClientTransferProgress> {
    if (this.#manifest.kind !== 'import' || !this.#state.inspection) throw new Error('[Holo Panels] Inspect an import file before starting it.')
    assertIdentifier(formatId, this.#manifest.formatIds, 'import format')
    const headers = new Set(this.#state.inspection.headers)
    const columns = new Set(this.#manifest.columns.map(column => column.key))
    if (mappings.some(mapping => !headers.has(mapping.header) || !columns.has(mapping.column))) throw new Error('[Holo Panels] Import mappings must use inspected headers and configured columns.')
    if (new Set(mappings.map(mapping => mapping.header)).size !== mappings.length || new Set(mappings.map(mapping => mapping.column)).size !== mappings.length) {
      throw new Error('[Holo Panels] Each import header and column can be mapped only once.')
    }
    for (const column of this.#manifest.columns.filter(column => column.required)) {
      if (!mappings.some(mapping => mapping.column === column.key)) throw new Error(`[Holo Panels] Required import column "${column.key}" is not mapped.`)
    }
    return this.run(signal => this.#transport.startImport({ definitionId: this.#manifest.id, formatId, mappings, uploadId: this.#state.inspection!.uploadId }, signal))
  }

  async startExport(formatId: string, columnIds: readonly string[], selection: TableSelectionPayload<TableRecordId>): Promise<ClientTransferProgress> {
    if (this.#manifest.kind !== 'export') throw new Error('[Holo Panels] Only export actions can start exports.')
    assertIdentifier(formatId, this.#manifest.formatIds, 'export format')
    if (columnIds.length === 0 || new Set(columnIds).size !== columnIds.length) throw new Error('[Holo Panels] Exports require unique selected columns.')
    for (const columnId of columnIds) assertIdentifier(columnId, this.#manifest.columns.map(column => column.id), 'export column')
    return this.run(signal => this.#transport.startExport({ columnIds, definitionId: this.#manifest.id, formatId, selection }, signal))
  }

  cancel(): void {
    this.#controller?.abort()
    this.#controller = null
  }

  private async run(operation: (signal: AbortSignal) => Promise<ClientTransferProgress>): Promise<ClientTransferProgress> {
    this.cancel()
    const controller = new AbortController()
    this.#controller = controller
    try {
      const progress = await operation(controller.signal)
      if (progress.completed < 0 || progress.total < progress.completed) throw new Error('[Holo Panels] Transfer progress is invalid.')
      this.publish({ error: null, progress })
      return progress
    } catch (cause) {
      this.publish({ error: cause instanceof Error ? cause.message : 'Transfer failed' })
      throw cause
    } finally {
      if (this.#controller === controller) this.#controller = null
    }
  }

  private publish(changes: Partial<ClientTransferState>): void {
    this.#state = Object.freeze({ ...this.#state, ...changes, version: this.#state.version + 1 })
    for (const listener of this.#listeners) listener(this.#state)
  }
}
