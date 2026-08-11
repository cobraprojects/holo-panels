import { belongsTo, belongsToMany, column, defineGeneratedTable, defineModel, hasMany, HasUlids } from '@holo-js/db'
import Comment from './Comment'
import { postTags } from './PostTag'
import Tag from './Tag'
import User from './User'

const posts = defineGeneratedTable('posts', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  title: column.string(),
  slug: column.string().unique(),
  excerpt: column.string(),
  body: column.string(),
  status: column.string(),
  categoryId: column.string(),
  authorId: column.string(),
  featuredMediaId: column.string().nullable(),
  category: column.string(),
  city: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(posts, {
  createdAtColumn: 'createdAt',
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
  relations: {
    author: belongsTo(() => User, 'authorId'),
    comments: hasMany(() => Comment, 'postId'),
    tags: belongsToMany(() => Tag, postTags, 'postId', 'tagId').withPivot('id', 'tenantId', 'position', 'createdAt', 'updatedAt'),
  },
  timestamps: true,
  traits: [HasUlids()],
  updatedAtColumn: 'updatedAt',
})
