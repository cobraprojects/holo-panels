<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <span
    data-slot="dropdown-menu-shortcut"
    :class="cn('hp:text-muted-foreground hp:ml-auto hp:text-xs hp:tracking-widest', props.class)"
  >
    <slot />
  </span>
</template>
