import type { ExporterManifest, ImporterManifest } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { ClientTransferStore } from '../src/actions/transfers'
import { createPanelTranslator } from '../src/locales'

const importer: ImporterManifest = {
  columns: [{ example: 'Ada', key: 'name', label: 'Name', required: true }],
  formatIds: ['csv'],
  id: 'users.import',
  kind: 'import',
  label: 'Import users',
  maxFileBytes: 1024,
  maxRows: 100,
  resourceId: 'users',
}

const exporter: ExporterManifest = {
  columns: [{ id: 'name', label: 'Name', visibleByDefault: true }],
  formatIds: ['csv'],
  id: 'users.export',
  kind: 'export',
  label: 'Export users',
  maxRows: 100,
  resourceId: 'users',
}

function transport() {
  return {
    inspectImport: vi.fn(async (_request, _signal, progress: (value: number) => void) => {
      progress(50)
      return { headers: ['Full name'], uploadId: 'upload-1' }
    }),
    startExport: vi.fn(async () => ({ completed: 0, operationId: 'export-1', status: 'queued' as const, total: 100 })),
    startImport: vi.fn(async () => ({ completed: 0, operationId: 'import-1', status: 'queued' as const, total: 100 })),
  }
}

describe('P16 transfer action client', () => {
  it('uses the active locale for import and export failure messages', async () => {
    const adapter = transport()
    const translate = createPanelTranslator('ar')
    adapter.inspectImport.mockRejectedValue('offline')
    adapter.startExport.mockRejectedValue('offline')
    const importStore = new ClientTransferStore(importer, adapter, translate)
    const exportStore = new ClientTransferStore(exporter, adapter, translate)
    await expect(importStore.inspect({ arrayBuffer: async () => new ArrayBuffer(1), name: 'users.csv', size: 12, type: 'text/csv' })).rejects.toBe('offline')
    await expect(exportStore.startExport('csv', ['name'], { mode: 'explicit', recordIds: [1] })).rejects.toBe('offline')
    expect(importStore.state.error).toBe('تعذر فحص ملف الاستيراد')
    expect(exportStore.state.error).toBe('تعذر نقل البيانات')
  })

  it('allow-lists inspected import mappings and publishes upload and operation progress', async () => {
    const adapter = transport()
    const store = new ClientTransferStore(importer, adapter)
    await store.inspect({ arrayBuffer: async () => new ArrayBuffer(1), name: 'users.csv', size: 12, type: 'text/csv' })
    expect(store.state.uploadProgress).toBe(100)
    await expect(store.startImport('csv', [{ column: 'name', header: 'Full name' }])).resolves.toMatchObject({ operationId: 'import-1' })
    await expect(store.startImport('csv', [{ column: 'admin', header: 'Full name' }])).rejects.toThrow('configured columns')
  })

  it('uses only configured export formats and columns with the table selection payload', async () => {
    const adapter = transport()
    const store = new ClientTransferStore(exporter, adapter)
    await store.startExport('csv', ['name'], { mode: 'explicit', recordIds: [1, 2] })
    expect(adapter.startExport).toHaveBeenCalledWith(expect.objectContaining({ columnIds: ['name'], selection: { mode: 'explicit', recordIds: [1, 2] } }), expect.any(AbortSignal))
    await expect(store.startExport('xlsx', ['name'], { mode: 'explicit', recordIds: [] })).rejects.toThrow('Unknown export format')
  })
})
