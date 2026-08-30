<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { DialogClose } from "reka-ui"
import { cn } from "@/lib/utils"
import { Button } from '@/ui/button'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  closeLabel?: string
  showCloseButton?: boolean
}>(), {
  closeLabel: 'Close',
  showCloseButton: false,
})
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="cn('hp:flex hp:flex-col-reverse hp:gap-2 hp:sm:flex-row hp:sm:justify-end', props.class)"
  >
    <slot />
    <DialogClose v-if="showCloseButton" as-child>
      <Button variant="outline">
        {{ closeLabel }}
      </Button>
    </DialogClose>
  </div>
</template>
