<script setup lang="ts">
import { computed, type HTMLAttributes, useAttrs } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (event: 'update:modelValue', payload: string | number): void
}>()

const attrs = useAttrs()
const fileInput = computed(() => attrs.type === 'file')
const inputClass = computed(() => cn(
  'hp:file:text-foreground hp:placeholder:text-muted-foreground hp:selection:bg-primary hp:selection:text-primary-foreground hp:dark:bg-input/30 hp:border-input hp:h-9 hp:w-full hp:min-w-0 hp:rounded-md hp:border hp:bg-transparent hp:px-3 hp:py-1 hp:text-base hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:file:inline-flex hp:file:h-7 hp:file:border-0 hp:file:bg-transparent hp:file:text-sm hp:file:font-medium hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:md:text-sm',
  'hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:focus-visible:ring-3',
  'hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive',
  props.class,
))
const inputValue = computed(() => props.modelValue ?? props.defaultValue)
const updateValue = (event: Event): void => {
  const input = event.currentTarget as HTMLInputElement
  emits('update:modelValue', input.type === 'number' && input.value !== '' ? input.valueAsNumber : input.value)
}
</script>

<template>
  <input
    v-if="fileInput"
    v-bind="attrs"
    :data-slot="typeof attrs['data-slot'] === 'string' ? attrs['data-slot'] : 'input'"
    :class="inputClass"
  >
  <input
    v-else
    v-bind="attrs"
    :data-slot="typeof attrs['data-slot'] === 'string' ? attrs['data-slot'] : 'input'"
    :class="inputClass"
    :value="inputValue"
    @input="updateValue"
  >
</template>
