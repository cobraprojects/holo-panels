import { defineMigration } from '@holo-js/db'

export const createPanelTransferTables = defineMigration({
  name: '2026_07_29_000001_create_panel_transfer_tables',
  async up({ schema }) {
    await schema.createTable('panel_transfer_operations', (table) => {
      table.string('id').primaryKey()
      table.integer('revision')
      table.string('status')
      table.text('payload')
      table.timestamp('cleanup_after').nullable()
      table.timestamp('updated_at')
      table.index(['status', 'updated_at'], 'panel_transfer_operations_status_updated_index')
      table.index(['cleanup_after'], 'panel_transfer_operations_cleanup_index')
    })
    await schema.createTable('panel_transfer_outbox', (table) => {
      table.string('id').primaryKey()
      table.string('operation_id')
      table.integer('operation_revision')
      table.integer('revision')
      table.integer('attempt').default(0)
      table.string('event_kind')
      table.text('payload')
      table.timestamp('available_at')
      table.string('lease_id').nullable()
      table.timestamp('lease_expires_at').nullable()
      table.string('failure_code').nullable()
      table.timestamp('updated_at')
      table.foreign('operation_id').references('id').on('panel_transfer_operations').restrictOnDelete()
      table.unique(['operation_id', 'operation_revision', 'event_kind'], 'panel_transfer_outbox_operation_event_unique')
      table.index(['available_at', 'lease_expires_at'], 'panel_transfer_outbox_available_lease_index')
    })
  },
  async down({ schema }) {
    await schema.dropTable('panel_transfer_outbox')
    await schema.dropTable('panel_transfer_operations')
  },
})
