<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card-footer"
    :class="cn('hp:flex hp:items-center hp:px-6 hp:[.border-t]:pt-6', props.class)"
  >
    <slot />
  </div>
</template>
