<script setup lang="ts">
import { type HTMLAttributes, useAttrs } from 'vue'
import { cn } from '../../lib/utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  class?: HTMLAttributes['class']
  defaultValue?: number | string
  modelValue?: number | string
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: number | string): void
}>()
const attrs = useAttrs()
const updateValue = (event: Event): void => emit('update:modelValue', (event.currentTarget as HTMLInputElement).value)
</script>

<template>
  <input
    v-bind="attrs"
    data-slot="input-group-control"
    :class="cn('hp:h-9 hp:w-full hp:min-w-0 hp:flex-1 hp:rounded-none hp:border-0 hp:bg-transparent hp:px-3 hp:py-1 hp:text-base hp:shadow-none hp:outline-none hp:placeholder:text-muted-foreground hp:focus-visible:ring-0 hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:md:text-sm hp:dark:bg-transparent', props.class)"
    :value="props.modelValue ?? props.defaultValue"
    @input="updateValue"
  >
</template>
