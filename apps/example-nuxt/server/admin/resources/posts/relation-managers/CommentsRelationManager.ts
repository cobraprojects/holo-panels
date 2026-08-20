import { RelationManager } from '@holo-js/panels'

export default class CommentsRelationManager extends RelationManager {
  protected static override relationship = 'comments'

  static table = this.configureTable(table => table
    .columns(column => [
      column.text('authorName'),
      column.text('body').limit(80).wrap(),
      column.text('status').badge(),
    ])
    .recordActions(action => [
      action.edit(),
      action.delete(),
    ])
  )
}
