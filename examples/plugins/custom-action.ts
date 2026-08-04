import { actionsFor, createExtensionTypeId } from '@holo-js/panels-core'

class Actor {
  declare readonly id: string
}

const actions = actionsFor({
  actor: Actor,
  input: { create: () => ({ selected: true }) },
  record: { create: () => ({ featured: false, id: '' }) },
})

export const featureActionType = createExtensionTypeId('acme.catalog', 'action', 'feature')

export const featureAction = actions.custom({
  authorize: () => true,
  handle: async () => ({ featured: true }),
  id: 'feature',
  kind: 'custom',
  label: 'Feature',
  mount: 'record',
  transactional: true,
  type: featureActionType,
})
