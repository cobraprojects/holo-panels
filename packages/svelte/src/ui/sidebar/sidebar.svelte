<script lang="ts">
	import * as Sheet from "../sheet/index.js";
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import { SIDEBAR_WIDTH_MOBILE } from "./constants.js";
	import { useSidebar } from "./context.svelte.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		side = "left",
		variant = "sidebar",
		collapsible = "offcanvas",
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		side?: "left" | "right";
		variant?: "sidebar" | "floating" | "inset";
		collapsible?: "offcanvas" | "icon" | "none";
	} = $props();

	const sidebar = useSidebar();
</script>

{#if collapsible === "none"}
	<div
		class={cn(
			"hp:flex hp:h-full hp:w-(--sidebar-width) hp:flex-col hp:bg-sidebar hp:text-sidebar-foreground",
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
{:else if sidebar.isMobile}
	<Sheet.Root bind:open={() => sidebar.openMobile, (v) => sidebar.setOpenMobile(v)} {...restProps}>
		<Sheet.Content
			bind:ref
			data-sidebar="sidebar"
			data-slot="sidebar"
			data-mobile="true"
			class={cn(
				"hp:w-(--sidebar-width) hp:bg-sidebar hp:p-0 hp:text-sidebar-foreground hp:[&>button]:hidden",
				className
			)}
			style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE};"
			{side}
		>
			<Sheet.Header class="hp:sr-only">
				<Sheet.Title>Sidebar</Sheet.Title>
				<Sheet.Description>Displays the mobile sidebar.</Sheet.Description>
			</Sheet.Header>
			<div class="hp:flex hp:h-full hp:w-full hp:flex-col">
				{@render children?.()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<div
		bind:this={ref}
		class="hp:group hp:peer hp:hidden hp:text-sidebar-foreground hp:md:block"
		data-state={sidebar.state}
		data-collapsible={sidebar.state === "collapsed" ? collapsible : ""}
		data-variant={variant}
		data-side={side}
		data-slot="sidebar"
	>
		<!-- This is what handles the sidebar gap on desktop -->
		<div
			data-slot="sidebar-gap"
			class={cn(
				"hp:transition-[width] hp:duration-200 hp:ease-linear hp:relative hp:w-(--sidebar-width) hp:bg-transparent",
				"group-data-[collapsible=offcanvas]:w-0",
				"group-data-[side=right]:rotate-180",
				variant === "floating" || variant === "inset"
					? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
					: "hp:group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
			)}
		></div>
		<div
			data-slot="sidebar-container"
			class={cn(
				"hp:fixed hp:inset-y-0 hp:z-10 hp:hidden hp:h-svh hp:w-(--sidebar-width) hp:transition-[left,right,width] hp:duration-200 hp:ease-linear hp:md:flex",
				side === "left"
					? "hp:start-0 hp:group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)]"
					: "hp:end-0 hp:group-data-[collapsible=offcanvas]:end-[calc(var(--sidebar-width)*-1)]",
				// Adjust the padding for floating and inset variants.
				variant === "floating" || variant === "inset"
					? "hp:p-2 hp:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
					: "hp:group-data-[collapsible=icon]:w-(--sidebar-width-icon) hp:group-data-[side=left]:border-e hp:group-data-[side=right]:border-s",
				className
			)}
			{...restProps}
		>
			<div
				data-sidebar="sidebar"
				data-slot="sidebar-inner"
				class="hp:bg-sidebar hp:group-data-[variant=floating]:rounded-lg hp:group-data-[variant=floating]:shadow-sm hp:group-data-[variant=floating]:ring-1 hp:group-data-[variant=floating]:ring-sidebar-border hp:flex hp:size-full hp:flex-col"
			>
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
