<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  defaultValue?: string | number
  modelValue?: string | number
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :class="cn('hp:border-input hp:placeholder:text-muted-foreground hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive hp:dark:bg-input/30 hp:flex hp:field-sizing-content hp:min-h-16 hp:w-full hp:rounded-md hp:border hp:bg-transparent hp:px-3 hp:py-2 hp:text-base hp:shadow-xs hp:transition-[color,box-shadow] hp:outline-none hp:focus-visible:ring-3 hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:md:text-sm', props.class)"
  />
</template>
