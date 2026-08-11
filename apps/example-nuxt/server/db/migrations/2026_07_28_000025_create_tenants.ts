import { defineMigration } from '@holo-js/db'

export default defineMigration({
  async up({ schema }) {
    await schema.createTable('tenants', (table) => {
      table.string('id').primaryKey()
      table.string('name')
      table.string('slug').unique()
    })
  },
  async down({ schema }) {
    await schema.dropTable('tenants')
  },
})
