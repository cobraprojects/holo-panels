<script setup lang="ts">
import type { ComponentPublicInstance, HTMLAttributes } from "vue"
import { ViewVerticalIcon } from '@radix-icons/vue'
import { nextTick, ref, watch } from 'vue'
import { cn } from "@/lib/utils"
import { Button } from '@/ui/button'
import { useSidebar } from "./utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  label?: string
}>()

const { isMobile, open, openMobile, toggleSidebar } = useSidebar()
const trigger = ref<HTMLButtonElement | ComponentPublicInstance>()

watch(openMobile, (nextOpen, previousOpen) => {
  if (!isMobile.value || !previousOpen || nextOpen) return
  void nextTick(() => {
    const current = trigger.value
    const element = current instanceof HTMLButtonElement ? current : current?.$el
    if (element instanceof HTMLButtonElement) element.focus()
  })
})
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    :aria-expanded="isMobile ? openMobile : open"
    ref="trigger"
    variant="ghost"
    size="icon"
    :class="cn('hp:h-7 hp:w-7', props.class)"
    @click="toggleSidebar"
  >
    <ViewVerticalIcon />
    <span class="hp:sr-only">{{ props.label ?? 'Toggle Sidebar' }}</span>
  </Button>
</template>
