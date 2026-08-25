<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="alert-dialog-footer"
    :class="
      cn(
        'hp:flex hp:flex-col-reverse hp:gap-2 hp:sm:flex-row hp:sm:justify-end',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
