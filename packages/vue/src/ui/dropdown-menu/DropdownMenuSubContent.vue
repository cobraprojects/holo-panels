<script setup lang="ts">
import type { DropdownMenuSubContentEmits, DropdownMenuSubContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  DropdownMenuSubContent,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<DropdownMenuSubContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuSubContent
    data-slot="dropdown-menu-sub-content"
    v-bind="forwarded"
    :class="cn('hp:bg-popover hp:text-popover-foreground hp:data-[state=open]:animate-in hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[state=open]:fade-in-0 hp:data-[state=closed]:zoom-out-95 hp:data-[state=open]:zoom-in-95 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:z-50 hp:min-w-[8rem] hp:max-w-(--reka-dropdown-menu-content-available-width) hp:origin-(--reka-dropdown-menu-content-transform-origin) hp:overflow-hidden hp:rounded-md hp:border hp:p-1 hp:shadow-lg', props.class)"
  >
    <slot />
  </DropdownMenuSubContent>
</template>
