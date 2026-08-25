import { RelationManager } from '@holo-js/panels'

export default class TagsRelationManager extends RelationManager {
  protected static override relationship = 'tags'

  static table = this.configureTable((table, component) => table
    .columns([
      component.TextColumn.make('name'),
      component.TextColumn.make('slug'),
    ])
    .headerActions([
      component.AttachAction.make(),
    ])
    .recordActions([
      component.ViewAction.make(),
      component.EditPivotAction.make(),
      component.DetachAction.make(),
    ])
  )
}
