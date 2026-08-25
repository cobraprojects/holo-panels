<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card-action"
    :class="cn('hp:col-start-2 hp:row-span-2 hp:row-start-1 hp:self-start hp:justify-self-end', props.class)"
  >
    <slot />
  </div>
</template>
