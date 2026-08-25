<script setup lang="ts">
import type { ListboxFilterProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { MagnifyingGlassIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import { ListboxFilter, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { useCommand } from "."

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<ListboxFilterProps & {
  class?: HTMLAttributes["class"]
}>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)

const { filterState } = useCommand()
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="hp:flex hp:h-9 hp:items-center hp:gap-2 hp:border-b hp:px-3"
  >
    <MagnifyingGlassIcon class="hp:size-4 hp:shrink-0 hp:opacity-50" />
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      v-model="filterState.search"
      data-slot="command-input"
      auto-focus
      :class="cn('hp:placeholder:text-muted-foreground hp:flex hp:h-10 hp:w-full hp:rounded-md hp:bg-transparent hp:py-3 hp:text-sm hp:outline-hidden hp:disabled:cursor-not-allowed hp:disabled:opacity-50', props.class)"
    />
  </div>
</template>
