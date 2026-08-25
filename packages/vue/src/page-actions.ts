import { defineComponent, h, onMounted, ref, Teleport, type PropType } from 'vue'

export const PanelsPageActions = defineComponent({
  name: 'PanelsPageActions',
  props: {
    to: { type: [Object, String] as PropType<HTMLElement | string | null>, default: undefined },
  },
  setup(props, { slots }) {
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })
    const actions = () => h('div', { class: 'hp-page-actions hp:flex hp:flex-wrap hp:items-center hp:justify-end hp:gap-2', 'data-slot': 'page-actions' }, slots.default?.())
    return () => props.to === undefined ? actions() : props.to ? h(Teleport, { defer: true, disabled: !mounted.value, to: props.to }, [actions()]) : null
  },
})
