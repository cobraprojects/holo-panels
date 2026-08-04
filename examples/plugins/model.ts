import { field, schema } from '@holo-js/forms'

export class Product {
  readonly id = 0
  readonly name = ''
  readonly rating = 0
  readonly status = 'draft'
}

export const productForm = schema({
  name: field.string().required(),
  rating: field.number().required().min(0).max(5),
  status: field.string().required(),
})
