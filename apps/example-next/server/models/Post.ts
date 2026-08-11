import { belongsTo, belongsToMany, column, defineGeneratedTable, defineModel, hasMany, HasUlids } from '@holo-js/db'
import Comment from './Comment'
import { postTags } from './PostTag'
import Tag from './Tag'
import User from './User'

const posts = defineGeneratedTable('posts', {
  id: column.string().primaryKey(),
  title: column.string(),
  slug: column.string().unique(),
  excerpt: column.text(),
  body: column.text(),
  status: column.string(),
  categoryId: column.string(),
  authorId: column.string(),
  featuredMediaId: column.string().nullable(),
  publishedAt: column.timestamp().nullable(),
  category: column.string(),
  city: column.string(),
  tenantId: column.string(),
  createdAt: column.timestamp(),
  updatedAt: column.timestamp(),
})

export default defineModel(posts, {
  fillable: ['title', 'slug', 'excerpt', 'body', 'status', 'categoryId', 'authorId', 'featuredMediaId', 'publishedAt', 'category', 'city'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  relations: {
    author: belongsTo(() => User, 'authorId'),
    comments: hasMany(() => Comment, 'postId'),
    tags: belongsToMany(() => Tag, postTags, 'postId', 'tagId').withPivot('id', 'tenantId', 'position'),
  },
  timestamps: false,
  traits: [HasUlids()],
})
