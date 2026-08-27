<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  readonly containerProps?: HTMLAttributes
}>()

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <div v-bind="props.containerProps" data-slot="table-container" :class="cn('hp:relative hp:w-full hp:overflow-x-auto', props.containerProps?.class)">
    <table v-bind="$attrs" data-slot="table" :class="cn('hp:w-full hp:caption-bottom hp:text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>
