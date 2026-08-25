import { loadPanelAuthPresentation, type PanelAuthPresentation } from '@holo-js/panels-vue'
import { onMounted, shallowRef, type ShallowRef } from 'vue'

export function useNuxtPanelAuthPresentation(panelId: string): ShallowRef<PanelAuthPresentation | null> {
  const presentation = shallowRef<PanelAuthPresentation | null>(null)
  onMounted(() => {
    void loadPanelAuthPresentation(panelId).then(value => { presentation.value = value })
  })
  return presentation
}
