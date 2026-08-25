<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <tfoot
    data-slot="table-footer"
    :class="cn('hp:bg-muted/50 hp:border-t hp:font-medium hp:[&>tr]:last:border-b-0', props.class)"
  >
    <slot />
  </tfoot>
</template>
