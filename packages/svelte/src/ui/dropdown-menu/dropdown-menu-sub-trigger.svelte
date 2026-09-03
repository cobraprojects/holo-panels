<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		children,
		...restProps
	}: DropdownMenuPrimitive.SubTriggerProps & {
		inset?: boolean;
	} = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
	bind:ref
	data-slot="dropdown-menu-sub-trigger"
	data-inset={inset}
	class={cn(
		"hp:gap-1.5 hp:rounded-md hp:px-1.5 hp:py-1 hp:text-sm hp:focus:bg-accent hp:focus:text-accent-foreground hp:not-data-[variant=destructive]:focus:**:text-accent-foreground hp:data-inset:ps-7 hp:data-open:bg-accent hp:data-open:text-accent-foreground hp:[&_svg:not([class*='size-'])]:size-4 hp:flex hp:cursor-default hp:items-center hp:outline-hidden hp:select-none hp:data-[inset]:ps-8 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronRightIcon class="hp:ms-auto" />
</DropdownMenuPrimitive.SubTrigger>
