<script setup lang="ts">
import type { LabelProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { Label } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<LabelProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <Label
    data-slot="label"
    v-bind="delegatedProps"
    :class="
      cn(
        'hp:flex hp:items-center hp:gap-2 hp:text-sm hp:leading-none hp:font-medium hp:select-none hp:group-data-[disabled=true]:pointer-events-none hp:group-data-[disabled=true]:opacity-50 hp:peer-disabled:cursor-not-allowed hp:peer-disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </Label>
</template>
