<script setup lang="ts">
import type { VueCustomWidgetProps } from '@holo-js/panels-vue'

defineProps<VueCustomWidgetProps>()
</script>

<template>
  <div><p>{{ data.properties.message }}</p><details><summary>Publishing details</summary><p>{{ data.properties.detail }}</p></details></div>
</template>
