<script setup lang="ts">
import type { SidebarProps } from "."
import { cn } from "@/lib/utils"
import { Sheet, SheetContent } from '@/ui/sheet'
import SheetDescription from '@/ui/sheet/SheetDescription.vue'
import SheetHeader from '@/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/ui/sheet/SheetTitle.vue'
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from "./utils"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SidebarProps>(), {
  side: "left",
  variant: "sidebar",
  collapsible: "offcanvas",
  closeLabel: "Close",
  mobileDescription: "Displays the mobile sidebar.",
  mobileTitle: "Sidebar",
})

const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
</script>

<template>
  <div
    v-if="collapsible === 'none'"
    data-slot="sidebar"
    :class="cn('hp:bg-sidebar hp:text-sidebar-foreground hp:flex hp:w-(--sidebar-width) hp:flex-col', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </div>

  <Sheet v-else-if="isMobile" :open="openMobile" v-bind="$attrs" @update:open="setOpenMobile">
    <SheetContent
      :close-label="closeLabel"
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      :side="side"
      :class="cn('hp:bg-sidebar hp:text-sidebar-foreground hp:w-(--sidebar-width) hp:p-0 hp:[&>button]:hidden', props.class)"
      :style="{
        '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
      }"
    >
      <SheetHeader class="hp:sr-only">
        <SheetTitle>{{ mobileTitle }}</SheetTitle>
        <SheetDescription>{{ mobileDescription }}</SheetDescription>
      </SheetHeader>
      <div class="hp:flex hp:h-full hp:w-full hp:flex-col">
        <slot />
      </div>
    </SheetContent>
  </Sheet>

  <div
    v-else
    class="hp:group hp:peer hp:text-sidebar-foreground hp:hidden hp:md:block"
    data-slot="sidebar"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :data-variant="variant"
    :data-side="side"
  >
    <!-- This is what handles the sidebar gap on desktop  -->
    <div
      :class="cn(
        'hp:relative hp:w-(--sidebar-width) hp:bg-transparent hp:transition-[width] hp:duration-200 hp:ease-linear',
        'hp:group-data-[collapsible=offcanvas]:w-0',
        'hp:group-data-[side=right]:rotate-180',
        variant === 'floating' || variant === 'inset'
          ? 'hp:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
          : 'hp:group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
      )"
    />
    <div
      :class="cn(
        'hp:fixed hp:inset-y-0 hp:z-10 hp:hidden hp:h-svh hp:w-(--sidebar-width) hp:transition-[left,right,width] hp:duration-200 hp:ease-linear hp:md:flex',
        side === 'left'
          ? 'hp:left-0 hp:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
          : 'hp:right-0 hp:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
        // Adjust the padding for floating and inset variants.
        variant === 'floating' || variant === 'inset'
          ? 'hp:p-2 hp:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
          : 'hp:group-data-[collapsible=icon]:w-(--sidebar-width-icon) hp:group-data-[side=left]:border-r hp:group-data-[side=right]:border-l',
        props.class,
      )"
      v-bind="$attrs"
    >
      <div
        data-sidebar="sidebar"
        class="hp:bg-sidebar hp:group-data-[variant=floating]:border-sidebar-border hp:flex hp:h-full hp:w-full hp:flex-col hp:group-data-[variant=floating]:rounded-lg hp:group-data-[variant=floating]:border hp:group-data-[variant=floating]:shadow-sm"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
