<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <p
    data-slot="empty-description"
    :class="cn(
      'hp:text-muted-foreground hp:[&>a:hover]:text-primary hp:text-sm/relaxed hp:[&>a]:underline hp:[&>a]:underline-offset-4',
      $attrs.class ?? 'hp:',
    )"
  >
    <slot />
  </p>
</template>
