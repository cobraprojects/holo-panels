import { defineTableWidget } from '@holo-js/panels'
import PostResource from '../resources/posts/PostResource'

export default defineTableWidget('recent-posts').table(PostResource)
  .heading('Recent posts')
  .columnSpan('full')
  .sort(2)
  .lazy()
  .poll(3000)
