<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn, type WithoutChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: "sm" | "default";
	} = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	class={cn(
		"hp:gap-1.5 hp:rounded-lg hp:border hp:border-input hp:bg-transparent hp:py-2 hp:pr-2 hp:pl-2.5 hp:text-sm hp:transition-colors hp:select-none hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:data-placeholder:text-muted-foreground hp:data-[size=default]:h-8 hp:data-[size=sm]:h-7 hp:data-[size=sm]:rounded-[min(var(--radius-md),10px)] hp:*:data-[slot=select-value]:flex hp:*:data-[slot=select-value]:gap-1.5 hp:dark:bg-input/30 hp:dark:hover:bg-input/50 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:[&_svg:not([class*='size-'])]:size-4 hp:flex hp:w-fit hp:items-center hp:justify-between hp:whitespace-nowrap hp:outline-none hp:disabled:cursor-not-allowed hp:disabled:opacity-50 hp:*:data-[slot=select-value]:line-clamp-1 hp:*:data-[slot=select-value]:flex hp:*:data-[slot=select-value]:items-center hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronDownIcon class="hp:size-4 hp:text-muted-foreground hp:pointer-events-none" />
</SelectPrimitive.Trigger>
