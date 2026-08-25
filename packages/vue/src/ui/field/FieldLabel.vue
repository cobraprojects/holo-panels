<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Label } from '@/ui/label'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <Label
    data-slot="field-label"
    :class="cn(
      'hp:group/field-label hp:peer/field-label hp:flex hp:w-fit hp:gap-2 hp:leading-snug hp:group-data-[disabled=true]/field:opacity-50',
      'hp:has-[>[data-slot=field]]:w-full hp:has-[>[data-slot=field]]:flex-col hp:has-[>[data-slot=field]]:rounded-md hp:has-[>[data-slot=field]]:border hp:[&>*]:data-[slot=field]:p-4',
      'hp:has-data-[state=checked]:bg-primary/5 hp:has-data-[state=checked]:border-primary hp:dark:has-data-[state=checked]:bg-primary/10',
      props.class,
    )"
  >
    <slot />
  </Label>
</template>
