import { RelationManager } from '@holo-js/panels'
import { AssociateAction, CreateAction, DeleteAction, DissociateAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { TextColumn } from '@holo-js/panels-tables'

export default class CommentsRelationManager extends RelationManager {
  protected static override relationship = 'comments'

  static table = this.configureTable(table => table
    .columns([
      TextColumn.make('authorName'),
      TextColumn.make('body').limit(80).wrap(),
      TextColumn.make('status').badge(),
    ])
    .headerActions([
      CreateAction.make(),
      AssociateAction.make(),
    ])
    .recordActions([
      ViewAction.make(),
      EditAction.make(),
      DissociateAction.make(),
      DeleteAction.make(),
    ])
  )
}
