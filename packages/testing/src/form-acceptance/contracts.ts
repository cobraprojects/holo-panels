import type {
  CollectionStore,
  FormStore,
  JsonValue,
  OptionStore,
  OptionValue,
  UploadStore,
} from '@holo-js/panels-client'

export type FormAcceptanceOperation = 'create' | 'edit'

export type FormAcceptanceRenderStage =
  | 'city-loading'
  | 'upload-progress'
  | 'upload-reordered'
  | 'upload-removed'
  | FormAcceptanceOperation

export interface FormAcceptanceRenderModel {
  readonly cityOptions: OptionStore<OptionValue>
  readonly form: FormStore<Record<string, unknown>>
  readonly operation: FormAcceptanceOperation
  readonly sections: CollectionStore<JsonValue>
  readonly stage: FormAcceptanceRenderStage
  readonly uploads: UploadStore
}

export interface FormAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly operation: FormAcceptanceOperation
  readonly ssrStable: boolean
  readonly stage: FormAcceptanceRenderStage
}

export interface FormAcceptanceFixture {
  readonly framework: FormAcceptanceRenderReport['framework']
  render(model: FormAcceptanceRenderModel): Promise<FormAcceptanceRenderReport>
}

export interface FormAcceptanceJourneyReport {
  readonly city: {
    readonly clearedAfterCountryChange: boolean
    readonly loadedLabels: readonly string[]
    readonly observedLoading: boolean
  }
  readonly framework: FormAcceptanceRenderReport['framework']
  readonly renderReports: readonly FormAcceptanceRenderReport[]
  readonly repeater: {
    readonly errorPathsAfterRemoval: readonly string[]
    readonly stableKeys: readonly string[]
  }
  readonly slug: {
    readonly create: string
    readonly edit: string
  }
  readonly upload: {
    readonly observedProgress: readonly number[]
    readonly orderedNames: readonly string[]
    readonly previewUrls: readonly string[]
    readonly removedNames: readonly string[]
  }
}
