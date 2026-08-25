<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Separator } from '@/ui/separator'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="field-separator"
    :data-content="!!$slots.default"
    :class="cn(
      'hp:relative hp:-my-2 hp:h-5 hp:text-sm hp:group-data-[variant=outline]/field-group:-mb-2',
      props.class,
    )"
  >
    <Separator class="hp:absolute hp:inset-0 hp:top-1/2" />
    <span
      v-if="$slots.default"
      class="hp:bg-background hp:text-muted-foreground hp:relative hp:mx-auto hp:block hp:w-fit hp:px-2"
      data-slot="field-separator-content"
    >
      <slot />
    </span>
  </div>
</template>
