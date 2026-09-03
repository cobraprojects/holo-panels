<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn, type WithoutChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children: childrenProp,
		...restProps
	}: WithoutChild<DropdownMenuPrimitive.RadioItemProps> = $props();
</script>

<DropdownMenuPrimitive.RadioItem
	bind:ref
	data-slot="dropdown-menu-radio-item"
	class={cn(
		"hp:gap-1.5 hp:rounded-md hp:py-1 hp:pe-8 hp:ps-1.5 hp:text-sm hp:focus:bg-accent hp:focus:text-accent-foreground hp:focus:**:text-accent-foreground hp:data-inset:ps-7 hp:[&_svg:not([class*='size-'])]:size-4 hp:relative hp:flex hp:cursor-default hp:items-center hp:outline-hidden hp:select-none hp:data-[disabled]:pointer-events-none hp:data-[disabled]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<span
			class="hp:absolute hp:end-2 hp:flex hp:items-center hp:justify-center hp:pointer-events-none"
			data-slot="dropdown-menu-radio-item-indicator"
		>
			{#if checked}
				<CheckIcon  />
			{/if}
		</span>
		{@render childrenProp?.({ checked })}
	{/snippet}
</DropdownMenuPrimitive.RadioItem>
