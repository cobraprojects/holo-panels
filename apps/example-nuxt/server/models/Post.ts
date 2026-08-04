import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const posts = defineGeneratedTable('posts', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  title: column.string(),
  slug: column.string(),
  excerpt: column.string(),
  body: column.string(),
  status: column.string(),
  categoryId: column.string(),
  authorId: column.string(),
  featuredMediaId: column.string().nullable(),
  category: column.string(),
  city: column.string(),
})

export default defineModel(posts, {
  fillable: [
    'title',
    'slug',
    'excerpt',
    'body',
    'status',
    'categoryId',
    'authorId',
    'featuredMediaId',
    'category',
    'city',
  ],
  guarded: ['id', 'tenantId'],
  traits: [HasUlids()],
  timestamps: true,
})
