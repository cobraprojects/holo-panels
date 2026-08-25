<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <p
    data-slot="field-description"
    :class="cn(
      'hp:text-muted-foreground hp:text-sm hp:leading-normal hp:font-normal hp:group-has-[[data-orientation=horizontal]]/field:text-balance',
      'hp:last:mt-0 hp:nth-last-2:-mt-1 hp:[[data-variant=legend]+&]:-mt-1.5',
      'hp:[&>a:hover]:text-primary hp:[&>a]:underline hp:[&>a]:underline-offset-4',
      props.class,
    )"
  >
    <slot />
  </p>
</template>
