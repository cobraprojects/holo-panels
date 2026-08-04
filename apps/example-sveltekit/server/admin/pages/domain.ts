import { defineCreatePage, defineEditPage, defineListPage, defineViewPage } from '@holo-js/panels'
import { canManageResource, ExampleAdminActor, type ExampleResourceId } from '../access'

interface DomainPageOptions {
  readonly label: string
  readonly mutations?: boolean
  readonly resourceId: ExampleResourceId
  readonly sort: number
}

export function defineDomainResourcePages(options: DomainPageOptions) {
  const path = `/admin/${options.resourceId}`
  const singular = options.label.endsWith('s') ? options.label.slice(0, -1) : options.label
  const authorize = (actor: ExampleAdminActor): boolean => canManageResource(actor, options.resourceId)

  const listBase = defineListPage(`${options.resourceId}.list`, {
    actor: ExampleAdminActor,
    load: () => ({ filters: { search: '' }, records: [] }),
    tenant: String,
  })
    .path(path)
    .authorize(context => authorize(context.actor))
    .title(options.label)
    .heading(options.label)
    .breadcrumbs([{ label: options.label, path }])
    .navigation({ group: 'Content', label: options.label, sort: options.sort })
  const list = options.mutations === false ? listBase : listBase.headerActions(`${options.resourceId}.create`)

  const create = defineCreatePage(`${options.resourceId}.create`, { actor: ExampleAdminActor, load: () => ({ mode: 'create' }), tenant: String })
    .path(`${path}/create`)
    .authorize(context => authorize(context.actor))
    .title(`Create ${singular.toLocaleLowerCase()}`)
    .heading(`Create ${singular.toLocaleLowerCase()}`)
    .breadcrumbs([
      { label: options.label, path },
      { label: 'Create', path: `${path}/create` },
    ])

  const viewBase = defineViewPage(`${options.resourceId}.view`, {
    actor: ExampleAdminActor,
    load: context => ({ recordId: context.parameters.record ?? '' }),
    tenant: String,
  })
    .path(`${path}/:record`)
    .authorize(context => authorize(context.actor))
    .title(`View ${singular.toLocaleLowerCase()}`)
    .heading(`${singular} details`)
    .breadcrumbs(context => [
      { label: options.label, path },
      { label: 'View', path: `${path}/${context.parameters.record}` },
    ])
  const view = options.mutations === false ? viewBase : viewBase.headerActions(`${options.resourceId}.edit`, `${options.resourceId}.delete`)

  const edit = defineEditPage(`${options.resourceId}.edit`, {
    actor: ExampleAdminActor,
    load: context => ({ recordId: context.parameters.record ?? '' }),
    tenant: String,
  })
    .path(`${path}/:record/edit`)
    .authorize(context => authorize(context.actor))
    .title(`Edit ${singular.toLocaleLowerCase()}`)
    .heading(`Edit ${singular.toLocaleLowerCase()}`)
    .breadcrumbs(context => [
      { label: options.label, path },
      { label: 'Edit', path: `${path}/${context.parameters.record}/edit` },
    ])
    .headerActions(`${options.resourceId}.delete`)

  return Object.freeze({ create, edit, list, view })
}
