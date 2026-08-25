<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<SelectPrimitive.ScrollUpButtonProps> = $props();
</script>

<SelectPrimitive.ScrollUpButton
	bind:ref
	data-slot="select-scroll-up-button"
	class={cn("hp:z-10 hp:flex hp:cursor-default hp:items-center hp:justify-center hp:bg-popover hp:py-1 hp:[&_svg:not([class*='size-'])]:size-4 hp:top-0 hp:w-full", className)}
	{...restProps}
>
	<ChevronUpIcon  />
</SelectPrimitive.ScrollUpButton>
