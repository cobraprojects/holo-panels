import { column, field } from '@holo-js/panels'

export const postResourceMetadata = Object.freeze({
  id: 'posts',
  recordTitle: 'title',
  routeKey: 'id',
  slug: 'posts',
})

export const postFormSchema = Object.freeze([
  field.text('title').required(),
  field.text('slug').required(),
  field.text('category').required(),
  field.text('city').required(),
])

export const postTableSchema = Object.freeze([
  column.text('title'),
  column.text('slug'),
  column.text('category'),
  column.text('city'),
])
