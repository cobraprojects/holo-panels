<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { AvatarRoot } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <AvatarRoot
    data-slot="avatar"
    :class="cn('hp:relative hp:flex hp:size-8 hp:shrink-0 hp:overflow-hidden hp:rounded-full', props.class)"
  >
    <slot />
  </AvatarRoot>
</template>
