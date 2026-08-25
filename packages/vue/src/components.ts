import {
  defineComponent,
  h,
  onErrorCaptured,
  ref,
  type PropType,
  type VNode,
} from 'vue'
import { ConfigProvider } from 'reka-ui'
import { Alert, AlertDescription, AlertTitle } from './internal-ui'
import { ComponentRegistry } from './registry'

export const PanelsPortalProvider = defineComponent({
  name: 'PanelsPortalProvider',
  props: {
    container: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  setup(props, { slots }) {
    return () => h(ConfigProvider, { teleportTo: props.container ?? undefined }, slots)
  },
})

export const PanelsErrorBoundary = defineComponent({
  name: 'PanelsErrorBoundary',
  setup(_props, { slots }) {
    const error = ref<Error>()
    onErrorCaptured(captured => {
      error.value = captured instanceof Error ? captured : new Error(String(captured))
      return false
    })
    return (): VNode | VNode[] | undefined => error.value
      ? h(Alert, { variant: 'destructive' }, () => [
          h(AlertTitle, {}, () => 'Something went wrong'),
          h(AlertDescription, {}, () => slots.fallback?.() ?? error.value?.message),
        ])
      : slots.default?.()
  },
})

export function createDefaultComponentRegistry(): ComponentRegistry {
  return new ComponentRegistry()
}
