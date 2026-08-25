import { RelationManager } from '@holo-js/panels'

export default class CommentsRelationManager extends RelationManager {
  protected static override relationship = 'comments'

  static table = this.configureTable((table, component) => table
    .columns([
      component.TextColumn.make('authorName'),
      component.TextColumn.make('body').limit(80).wrap(),
      component.TextColumn.make('status').badge(),
    ])
    .headerActions([
      component.CreateAction.make(),
      component.AssociateAction.make(),
    ])
    .recordActions([
      component.ViewAction.make(),
      component.EditAction.make(),
      component.DissociateAction.make(),
      component.DeleteAction.make(),
    ])
  )
}
