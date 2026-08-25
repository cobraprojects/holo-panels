<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <main
    data-slot="sidebar-inset"
    :class="cn(
      'hp:bg-background hp:relative hp:flex hp:w-full hp:flex-1 hp:flex-col',
      'hp:md:peer-data-[variant=inset]:m-2 hp:md:peer-data-[variant=inset]:ml-0 hp:md:peer-data-[variant=inset]:rounded-xl hp:md:peer-data-[variant=inset]:shadow-sm hp:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
      props.class,
    )"
  >
    <slot />
  </main>
</template>
