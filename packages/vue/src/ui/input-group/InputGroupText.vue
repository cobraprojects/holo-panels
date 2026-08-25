<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <span :class="cn('hp:flex hp:items-center hp:gap-2 hp:text-sm hp:text-muted-foreground hp:[&_svg]:pointer-events-none hp:[&_svg:not([class*=size-])]:size-4', props.class)"><slot /></span>
</template>
