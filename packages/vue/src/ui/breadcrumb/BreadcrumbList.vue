<script lang="ts" setup>
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <ol
    data-slot="breadcrumb-list"
    :class="cn('hp:text-muted-foreground hp:flex hp:flex-wrap hp:items-center hp:gap-1.5 hp:text-sm hp:break-words hp:sm:gap-2.5', props.class)"
  >
    <slot />
  </ol>
</template>
