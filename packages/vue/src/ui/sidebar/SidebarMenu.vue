<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <ul
    data-slot="sidebar-menu"
    data-sidebar="menu"
    :class="cn('hp:flex hp:w-full hp:min-w-0 hp:flex-col hp:gap-1', props.class)"
  >
    <slot />
  </ul>
</template>
