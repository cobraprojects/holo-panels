<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { cn } from "@/lib/utils"
import TableCell from "./TableCell.vue"
import TableRow from "./TableRow.vue"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  colspan?: number
}>(), {
  colspan: 1,
})

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <TableRow>
    <TableCell
      :class="
        cn(
          'hp:p-4 hp:whitespace-nowrap hp:align-middle hp:text-sm hp:text-foreground',
          props.class,
        )
      "
      v-bind="delegatedProps"
    >
      <div class="hp:flex hp:items-center hp:justify-center hp:py-10">
        <slot />
      </div>
    </TableCell>
  </TableRow>
</template>
