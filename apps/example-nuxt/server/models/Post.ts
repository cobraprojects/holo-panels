import { belongsTo, belongsToMany, defineModel, hasMany, HasUlids } from '@holo-js/db'
import Comment from './Comment'
import Tag from './Tag'
import User from './User'

export default defineModel('posts', {
  fillable: ['title', 'slug', 'excerpt', 'body', 'status', 'categoryId', 'authorId', 'featuredMediaId', 'category', 'city'],
  guarded: ['id', 'tenantId'],
  relations: {
    author: belongsTo(() => User, 'authorId'),
    comments: hasMany(() => Comment, 'postId'),
    tags: belongsToMany(() => Tag, 'post_tags', 'postId', 'tagId').withPivot('id', 'tenantId', 'position'),
  },
  timestamps: true,
  traits: [HasUlids()],
})
