import { RelationManager } from '@holo-js/panels'

export default class TagsRelationManager extends RelationManager {
  protected static override relationship = 'tags'

  static table = this.configureTable(table => table
    .columns(column => [
      column.text('name'),
      column.text('slug'),
    ])
    .recordActions(action => [
      action.edit(),
      action.delete(),
    ])
  )
}
