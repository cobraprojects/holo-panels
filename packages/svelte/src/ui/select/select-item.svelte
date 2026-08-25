<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn, type WithoutChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		value,
		label,
		children: childrenProp,
		...restProps
	}: WithoutChild<SelectPrimitive.ItemProps> = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	{value}
	data-slot="select-item"
	class={cn(
		"hp:gap-1.5 hp:rounded-md hp:py-1 hp:pr-8 hp:pl-1.5 hp:text-sm hp:focus:bg-accent hp:focus:text-accent-foreground hp:not-data-[variant=destructive]:focus:**:text-accent-foreground hp:[&_svg:not([class*='size-'])]:size-4 hp:*:[span]:last:flex hp:*:[span]:last:items-center hp:*:[span]:last:gap-2 hp:relative hp:flex hp:w-full hp:cursor-default hp:items-center hp:outline-hidden hp:select-none hp:focus:bg-accent hp:focus:text-accent-foreground hp:data-highlighted:bg-accent hp:data-highlighted:text-accent-foreground hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		<span class="hp:absolute hp:end-2 hp:flex hp:size-3.5 hp:items-center hp:justify-center">
			{#if selected}
				<CheckIcon class="hp:cn-select-item-indicator-icon" />
			{/if}
		</span>
		<span class="hp:flex hp:flex-1 hp:gap-2 hp:shrink-0 hp:whitespace-nowrap">
			{#if childrenProp}
				{@render childrenProp({ selected, highlighted })}
			{:else}
				{label || value}
			{/if}
		</span>
	{/snippet}
</SelectPrimitive.Item>
