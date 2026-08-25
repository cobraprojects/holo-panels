<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <div data-slot="table-container" class="hp:relative hp:w-full hp:overflow-auto">
    <table v-bind="$attrs" data-slot="table" :class="cn('hp:w-full hp:caption-bottom hp:text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>
