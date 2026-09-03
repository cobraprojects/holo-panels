<script setup lang="ts">
import type { DropdownMenuCheckboxItemEmits, DropdownMenuCheckboxItemProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { CheckIcon } from '@radix-icons/vue'
import { reactiveOmit } from "@vueuse/core"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DropdownMenuCheckboxItemProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<DropdownMenuCheckboxItemEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuCheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    v-bind="forwarded"
    :class=" cn(
      `hp:focus:bg-accent hp:focus:text-accent-foreground hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:py-1.5 hp:pe-2 hp:ps-8 hp:text-sm hp:outline-hidden hp:select-none hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4`,
      props.class,
    )"
  >
    <span class="hp:pointer-events-none hp:absolute hp:start-2 hp:flex hp:size-3.5 hp:items-center hp:justify-center">
      <DropdownMenuItemIndicator>
        <slot name="indicator-icon">
          <CheckIcon class="hp:size-4" />
        </slot>
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>
