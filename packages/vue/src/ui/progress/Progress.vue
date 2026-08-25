<script setup lang="ts">
import type { ProgressRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { cn } from '../../lib/utils'

const props = withDefaults(defineProps<ProgressRootProps & { class?: HTMLAttributes['class'] }>(), { modelValue: 0 })
const delegatedProps = reactiveOmit(props, 'class')
const percentage = computed(() => {
  const maximum = props.max && props.max > 0 ? props.max : 100
  return Math.max(0, Math.min(100, ((props.modelValue ?? 0) / maximum) * 100))
})
</script>

<template>
  <ProgressRoot data-slot="progress" v-bind="delegatedProps" :class="cn('hp:relative hp:h-2 hp:w-full hp:overflow-hidden hp:rounded-full hp:bg-primary/20', props.class)">
    <ProgressIndicator data-slot="progress-indicator" class="hp:h-full hp:w-full hp:flex-1 hp:bg-primary hp:transition-all" :style="{ transform: `translateX(-${100 - percentage}%)` }" />
  </ProgressRoot>
</template>
