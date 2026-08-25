<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="field-group"
    :class="cn(
      'hp:group/field-group hp:@container/field-group hp:flex hp:w-full hp:flex-col hp:gap-7 hp:data-[slot=checkbox-group]:gap-3 hp:[&>[data-slot=field-group]]:gap-4',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
