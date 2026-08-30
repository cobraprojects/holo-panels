<script lang="ts">
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
	import { Button } from "../button/index.js";
	import { cn } from "../../lib/utils.js";
	import { useSidebar } from "./context.svelte.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		onclick,
		label = "Toggle Sidebar",
		...restProps
	}: ComponentProps<typeof Button> & {
		onclick?: (e: MouseEvent) => void;
		label?: string;
	} = $props();

	const sidebar = useSidebar();
	let previousOpenMobile = false;

	$effect(() => {
		const openMobile = sidebar.openMobile;
		if (sidebar.isMobile && previousOpenMobile && !openMobile) {
			queueMicrotask(() => ref?.focus());
		}
		previousOpenMobile = openMobile;
	});
</script>

<Button
	bind:ref
	data-sidebar="trigger"
	data-slot="sidebar-trigger"
	aria-expanded={sidebar.isMobile ? sidebar.openMobile : sidebar.open}
	variant="ghost"
	size="icon-sm"
	class={cn("hp:size-7", className)}
	type="button"
	onclick={(e) => {
		onclick?.(e);
		sidebar.toggle();
	}}
	{...restProps}
>
	<PanelLeftIcon  />
	<span class="hp:sr-only">{label}</span>
</Button>
