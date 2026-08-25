<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  SwitchRoot,
  SwitchThumb,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<SwitchRootProps & { class?: HTMLAttributes["class"] }>()

const emits = defineEmits<SwitchRootEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    v-bind="forwarded"
    :class="cn(
      'hp:peer hp:data-[state=checked]:bg-primary hp:data-[state=unchecked]:bg-input hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:dark:data-[state=unchecked]:bg-input/80 hp:inline-flex hp:h-[1.15rem] hp:w-8 hp:shrink-0 hp:items-center hp:rounded-full hp:border hp:border-transparent hp:shadow-xs hp:transition-all hp:outline-none hp:focus-visible:ring-3 hp:disabled:cursor-not-allowed hp:disabled:opacity-50',
      props.class,
    )"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :class="cn('hp:bg-background hp:dark:data-[state=unchecked]:bg-foreground hp:dark:data-[state=checked]:bg-primary-foreground hp:pointer-events-none hp:block hp:size-4 hp:rounded-full hp:ring-0 hp:transition-transform hp:data-[state=checked]:translate-x-[calc(100%-2px)] hp:data-[state=unchecked]:translate-x-0')"
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
