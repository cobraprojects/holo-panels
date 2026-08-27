import { ClientActionStore, ClientToastStore, EntryStateStore, type ClientActionManifest, type JsonValue } from '@holo-js/panels-client'
import { panelNotification } from '@holo-js/panels-core'
import type {
  InfolistActionAcceptanceFixture,
  InfolistActionAcceptanceJourneyReport,
  InfolistActionAcceptanceModel,
} from './contracts'

function manifest(overrides: Partial<ClientActionManifest> & Pick<ClientActionManifest, 'id' | 'label'>): ClientActionManifest {
  return {
    badge: null,
    color: null,
    confirmation: null,
    disabled: false,
    icon: null,
    kind: 'custom',
    modal: null,
    mount: 'record',
    size: 'medium',
    tooltip: null,
    type: 'core:action:custom',
    visible: true,
    ...overrides,
  }
}

function entryStore(
  id: string,
  type: string,
  label: string,
  value: JsonValue,
  actions: readonly string[] = [],
): EntryStateStore {
  return new EntryStateStore(id, {
    actions,
    copyable: false,
    defaultValue: value,
    extraAttributes: {},
    formatters: [],
    inlineLabel: false,
    label,
    layout: {},
    path: id,
    placeholder: null,
    properties: {},
    slots: {},
    type,
    visible: true,
  })
}

export async function runInfolistActionAcceptanceJourney(
  fixture: InfolistActionAcceptanceFixture,
): Promise<InfolistActionAcceptanceJourneyReport> {
  const requests: InfolistActionAcceptanceJourneyReport['requests'][number][] = []
  const entryActions: string[] = []
  const notificationStore = new ClientToastStore()
  let resolvePublish: (() => void) | undefined
  const publishFinished = new Promise<void>(resolve => { resolvePublish = resolve })
  let sequence = 0
  const actions = {
    denied: manifest({ id: 'posts.denied', label: 'Denied action' }),
    nested: manifest({ id: 'posts.audit', label: 'Audit details', mount: 'modal' }),
    publish: manifest({
      confirmation: 'Publish this record?',
      id: 'posts.publish',
      label: 'Publish post',
      modal: {
        alignment: 'center',
        autofocus: true,
        cancelActionLabel: null,
        closeByClickingAway: true,
        closeByEscaping: true,
        content: null,
        description: null,
        footer: null,
        heading: null,
        icon: null,
        iconColor: null,
        nestedActions: [],
        schema: { components: [], id: 'publish-reason', kind: 'schema' },
        slideOver: false,
        stickyFooter: false,
        stickyHeader: false,
        submitActionLabel: null,
        width: 'medium',
      },
    }),
  }
  const actionStore = new ClientActionStore<string>({
    createIdempotencyKey: () => `acceptance-${++sequence}`,
    transport: {
      async execute(request) {
        requests.push({ actionId: request.actionId, input: request.input, mount: request.mount, ...(request.recordIds ? { recordIds: request.recordIds } : {}) })
        if (request.actionId === actions.denied.id) {
          notificationStore.push(panelNotification('posts.denied.failed')
            .title('Action failed')
            .body('The operation could not be completed.')
            .status('danger')
            .presentation())
          throw new Error('The action could not be completed')
        }
        await publishFinished
        notificationStore.push(panelNotification('posts.publish.succeeded')
          .title('Action completed')
          .body('The operation completed successfully.')
          .status('success')
          .presentation())
        return { effects: [], items: [], result: 'published', status: 'succeeded' }
      },
    },
  })
  const model: InfolistActionAcceptanceModel = {
    actions,
    actionStore,
    entries: [
      entryStore('title', 'text', 'Title', 'Cairo Guide', ['inspect']),
      entryStore('published', 'boolean', 'Published', true),
      entryStore('metadata', 'key-value', 'Metadata', { locale: 'en', region: 'Africa' }),
      entryStore('topics', 'repeatable', 'Topics', ['travel', 'history']),
    ],
    entryAction: id => { entryActions.push(id) },
    notificationStore,
  }
  const render = await fixture.render(model)
  const driver = await fixture.mount(model)
  try {
    await driver.clickText('inspect')
    await driver.clickText('Publish post')
    await driver.clickText('Confirm')
    await driver.sync(() => actionStore.setInput({ reason: 'Reviewed' }))
    await driver.clickText('Run action')
    const submittingMarkup = driver.markup()
    resolvePublish?.()
    await driver.sync(async () => { await actionStore.submit([42]) })
    const successMarkup = driver.markup()
    const successToast = model.notificationStore.state.items.at(-1)
    await driver.sync(() => actionStore.mount(actions.publish))
    await driver.sync(() => actionStore.mount(actions.nested))
    const activeDialogCount = (driver.markup().match(/role="(?:alert)?dialog"/gu) ?? []).length
    await driver.keydown('[data-panels-component="modal"]:last-of-type', 'Escape')
    const remainingDialogCount = (driver.markup().match(/role="(?:alert)?dialog"/gu) ?? []).length
    await driver.sync(() => actionStore.close())
    await driver.sync(() => actionStore.mount(actions.denied))
    await driver.sync(async () => {
      try {
        await actionStore.submit([42])
      } catch {
        return
      }
    })
    const deniedMarkup = driver.markup()
    const deniedToast = model.notificationStore.state.items.at(-1)
    return {
      deniedMarkup,
      deniedNotification: deniedToast ? { body: deniedToast.body, title: deniedToast.title } : null,
      entryActions,
      framework: fixture.framework,
      activeDialogCount,
      remainingDialogCount,
      render,
      requests,
      submittingMarkup,
      successNotification: successToast ? { body: successToast.body, title: successToast.title } : null,
      successMarkup,
    }
  } finally {
    await driver.dispose()
  }
}
