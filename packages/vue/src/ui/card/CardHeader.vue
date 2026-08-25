<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card-header"
    :class="cn('hp:@container/card-header hp:grid hp:auto-rows-min hp:grid-rows-[auto_auto] hp:items-start hp:gap-1.5 hp:px-6 hp:has-data-[slot=card-action]:grid-cols-[1fr_auto] hp:[.border-b]:pb-6', props.class)"
  >
    <slot />
  </div>
</template>
