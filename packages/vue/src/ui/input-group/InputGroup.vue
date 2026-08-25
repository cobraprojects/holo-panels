<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    data-slot="input-group"
    role="group"
    :class="cn(
      'hp:group/input-group hp:relative hp:flex hp:h-9 hp:w-full hp:min-w-0 hp:items-center hp:rounded-md hp:border hp:border-input hp:shadow-xs hp:outline-none hp:transition-[color,box-shadow] hp:has-[>textarea]:h-auto hp:dark:bg-input/30',
      'hp:has-[>[data-align=inline-start]]:[&>input]:pl-2 hp:has-[>[data-align=inline-end]]:[&>input]:pr-2',
      'hp:has-[>[data-align=block-start]]:h-auto hp:has-[>[data-align=block-start]]:flex-col hp:has-[>[data-align=block-start]]:[&>input]:pb-3',
      'hp:has-[>[data-align=block-end]]:h-auto hp:has-[>[data-align=block-end]]:flex-col hp:has-[>[data-align=block-end]]:[&>input]:pt-3',
      'hp:has-[[data-slot=input-group-control]:focus-visible]:border-ring hp:has-[[data-slot=input-group-control]:focus-visible]:ring-3 hp:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50',
      'hp:has-[[data-slot][aria-invalid=true]]:border-destructive hp:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 hp:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',
      props.class,
    )"
  ><slot /></div>
</template>
