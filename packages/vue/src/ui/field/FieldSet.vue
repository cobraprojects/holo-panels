<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <fieldset
    data-slot="field-set"
    :class="cn(
      'hp:flex hp:flex-col hp:gap-6',
      'hp:has-[>[data-slot=checkbox-group]]:gap-3 hp:has-[>[data-slot=radio-group]]:gap-3',
      props.class,
    )"
  >
    <slot />
  </fieldset>
</template>
