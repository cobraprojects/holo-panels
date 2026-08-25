<script setup lang="ts">
import type { TabsListProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsList } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<TabsListProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :class="cn(
      'hp:bg-muted hp:text-muted-foreground hp:inline-flex hp:h-9 hp:w-fit hp:items-center hp:justify-center hp:rounded-lg hp:p-0.75',
      props.class,
    )"
  >
    <slot />
  </TabsList>
</template>
