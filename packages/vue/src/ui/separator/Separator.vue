<script setup lang="ts">
import type { SeparatorProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { Separator } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<
  SeparatorProps & { class?: HTMLAttributes["class"] }
>(), {
  orientation: "horizontal",
  decorative: true,
})

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <Separator
    data-slot="separator"
    v-bind="delegatedProps"
    :class="
      cn(
        'hp:bg-border hp:shrink-0 hp:data-[orientation=horizontal]:h-px hp:data-[orientation=horizontal]:w-full hp:data-[orientation=vertical]:h-full hp:data-[orientation=vertical]:w-px',
        props.class,
      )
    "
  />
</template>
