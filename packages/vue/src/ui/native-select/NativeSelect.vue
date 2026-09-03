<script setup lang="ts">
import type { AcceptableValue } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { ChevronDownIcon } from '@radix-icons/vue'
import { reactiveOmit, useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{ modelValue?: AcceptableValue | AcceptableValue[], class?: HTMLAttributes["class"] }>()

const emit = defineEmits<{
  "update:modelValue": AcceptableValue
}>()

const modelValue = useVModel(props, "modelValue", emit, {
  passive: true,
  defaultValue: "",
})

const delegatedProps = reactiveOmit(props, ["class", "modelValue"])
</script>

<template>
  <div
    class="hp:group/native-select hp:relative hp:w-full hp:has-[select:disabled]:opacity-50"
    data-slot="native-select-wrapper"
  >
    <select
      v-bind="{ ...$attrs, ...delegatedProps }"
      v-model="modelValue"
      data-slot="native-select"
      :class="cn(
        'hp:border-input hp:placeholder:text-muted-foreground hp:selection:bg-primary hp:selection:text-primary-foreground hp:dark:bg-input/30 hp:dark:hover:bg-input/50 hp:h-9 hp:w-full hp:min-w-0 hp:appearance-none hp:rounded-md hp:border hp:bg-transparent hp:px-3 hp:py-2 hp:pe-9 hp:text-sm hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed',
        'hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:focus-visible:ring-3',
        'hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive',
        props.class,
      )"
    >
      <slot />
    </select>
    <ChevronDownIcon
      class="hp:text-muted-foreground hp:pointer-events-none hp:absolute hp:top-1/2 hp:right-3.5 hp:size-4 hp:-translate-y-1/2 hp:opacity-50 hp:select-none"
      aria-hidden="true"
      data-slot="native-select-icon"
    />
  </div>
</template>
