import type { ClientActionManifest, ClientActionStore, ClientToastStore, EntryStateStore } from '@holo-js/panels-client'

export interface InfolistActionAcceptanceModel {
  readonly actions: {
    readonly denied: ClientActionManifest
    readonly nested: ClientActionManifest
    readonly publish: ClientActionManifest
  }
  readonly actionStore: ClientActionStore<string>
  readonly entries: readonly EntryStateStore[]
  readonly entryAction: (id: string) => void
  readonly notificationStore: ClientToastStore
}

export interface InfolistActionAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly ssrStable: boolean
}

export interface InfolistActionAcceptanceDriver {
  clickText(text: string): Promise<void>
  dispose(): Promise<void>
  input(selector: string, value: string): Promise<void>
  keydown(selector: string, key: string): Promise<void>
  markup(): string
  sync(operation: () => Promise<void> | void): Promise<void>
}

export interface InfolistActionAcceptanceFixture {
  readonly framework: InfolistActionAcceptanceRenderReport['framework']
  mount(model: InfolistActionAcceptanceModel): Promise<InfolistActionAcceptanceDriver>
  render(model: InfolistActionAcceptanceModel): Promise<InfolistActionAcceptanceRenderReport>
}

export interface InfolistActionAcceptanceJourneyReport {
  readonly deniedMarkup: string
  readonly deniedNotification: { readonly body: string | null, readonly title: string } | null
  readonly entryActions: readonly string[]
  readonly framework: InfolistActionAcceptanceRenderReport['framework']
  readonly activeDialogCount: number
  readonly remainingDialogCount: number
  readonly render: InfolistActionAcceptanceRenderReport
  readonly requests: readonly {
    readonly actionId: string
    readonly input: Readonly<Record<string, unknown>>
    readonly mount: ClientActionManifest['mount']
    readonly recordIds?: readonly (number | string)[]
  }[]
  readonly submittingMarkup: string
  readonly successNotification: { readonly body: string | null, readonly title: string } | null
  readonly successMarkup: string
}
