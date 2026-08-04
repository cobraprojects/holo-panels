import { defineCreatePage, defineEditPage, defineListPage, defineViewPage } from '@holo-js/panels'
import { AdminActor, canManageResource } from '../pages/posts/access'

export function createResourcePages(resourceId: string, label: string, icon: string, sort: number) {
  const singular = label.endsWith('s') ? label.slice(0, -1).toLowerCase() : label.toLowerCase()
  const basePath = `/admin/${resourceId}`
  const authorize = (actor: AdminActor): boolean => canManageResource(actor, resourceId)
  return Object.freeze({
    create: defineCreatePage(`${resourceId}-create`, { actor: AdminActor, load: () => ({ operation: 'create', resourceId }) })
      .path(`${basePath}/create`)
      .authorize(context => authorize(context.actor))
      .title(`Create ${singular}`)
      .heading(`Create ${singular}`)
      .breadcrumbs([{ label, path: basePath }])
      .body('resource-page', { operation: 'create', resourceId }),
    edit: defineEditPage(`${resourceId}-edit`, { actor: AdminActor, load: context => ({ operation: 'edit', recordId: context.parameters.record ?? '', resourceId }) })
      .path(`${basePath}/:record/edit`)
      .authorize(context => authorize(context.actor))
      .title(context => `Edit ${singular} ${context.parameters.record ?? ''}`.trim())
      .heading(`Edit ${singular}`)
      .breadcrumbs([{ label, path: basePath }])
      .body('resource-page', { operation: 'edit', resourceId }),
    list: defineListPage(resourceId, { actor: AdminActor, load: () => ({ operation: 'list', resourceId }) })
      .path(basePath)
      .authorize(context => authorize(context.actor))
      .title(label)
      .heading(`Manage ${label.toLowerCase()}`)
      .navigation({ icon, label, sort })
      .body('resource-page', { operation: 'list', resourceId }),
    view: defineViewPage(`${resourceId}-view`, { actor: AdminActor, load: context => ({ operation: 'view', recordId: context.parameters.record ?? '', resourceId }) })
      .path(`${basePath}/:record`)
      .authorize(context => authorize(context.actor))
      .title(context => `${label} ${context.parameters.record ?? ''}`.trim())
      .heading(`View ${singular}`)
      .breadcrumbs([{ label, path: basePath }])
      .body('resource-page', { operation: 'view', resourceId }),
  })
}
