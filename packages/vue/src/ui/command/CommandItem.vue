<script setup lang="ts">
import type { ListboxItemEmits, ListboxItemProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit, useCurrentElement } from "@vueuse/core"
import { ListboxItem, useForwardPropsEmits, useId } from "reka-ui"
import { computed, onMounted, onUnmounted, ref } from "vue"
import { cn } from "@/lib/utils"
import { useCommand, useCommandGroup } from './context'

const props = defineProps<ListboxItemProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<ListboxItemEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const id = useId()
const { filterState, allItems, allGroups } = useCommand()
const groupContext = useCommandGroup(null)

const isRender = computed(() => {
  if (!filterState.search) {
    return true
  }
  else {
    const filteredCurrentItem = filterState.filtered.items.get(id)
    // If the filtered items is undefined means not in the all times map yet
    // Do the first render to add into the map
    if (filteredCurrentItem === undefined) {
      return true
    }

    // Check with filter
    return filteredCurrentItem > 0
  }
})

const itemRef = ref()
const currentElement = useCurrentElement(itemRef)
onMounted(() => {
  if (!(currentElement.value instanceof HTMLElement))
    return

  // textValue to perform filter
  allItems.value.set(id, currentElement.value.textContent ?? (props.value?.toString() ?? ""))

  const groupId = groupContext?.id
  if (groupId) {
    if (!allGroups.value.has(groupId)) {
      allGroups.value.set(groupId, new Set([id]))
    }
    else {
      allGroups.value.get(groupId)?.add(id)
    }
  }
})
onUnmounted(() => {
  allItems.value.delete(id)
})
</script>

<template>
  <ListboxItem
    v-if="isRender"
    v-bind="forwarded"
    :id="id"
    ref="itemRef"
    data-slot="command-item"
    :class="cn(`hp:data-[highlighted]:bg-accent hp:data-[highlighted]:text-accent-foreground hp:[&_svg:not([class*='text-'])]:text-muted-foreground hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4`, props.class)"
    @select="() => {
      filterState.search = ''
    }"
  >
    <slot />
  </ListboxItem>
</template>
