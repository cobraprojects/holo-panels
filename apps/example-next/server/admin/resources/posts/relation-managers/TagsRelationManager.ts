import { RelationManager } from '@holo-js/panels'
import { AttachAction, DetachAction, EditPivotAction, ViewAction } from '@holo-js/panels-actions'
import { TextColumn } from '@holo-js/panels-tables'

export default class TagsRelationManager extends RelationManager {
  protected static override relationship = 'tags'

  static table = this.configureTable(table => table
    .columns([
      TextColumn.make('name'),
      TextColumn.make('slug'),
    ])
    .headerActions([
      AttachAction.make(),
    ])
    .recordActions([
      ViewAction.make(),
      EditPivotAction.make(),
      DetachAction.make(),
    ])
  )
}
