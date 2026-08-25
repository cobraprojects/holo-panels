<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: CommandPrimitive.ItemProps = $props();
</script>

<CommandPrimitive.Item
	bind:ref
	data-slot="command-item"
	class={cn(
		"hp:group/command-item hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:in-data-[slot=dialog-content]:rounded-lg! hp:data-selected:bg-muted hp:data-selected:text-foreground hp:data-[disabled=true]:pointer-events-none hp:data-[disabled=true]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4 hp:data-selected:*:[svg]:text-foreground",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<CheckIcon class="hp:cn-command-item-indicator hp:ml-auto hp:opacity-0 hp:group-has-[[data-slot=command-shortcut]]/command-item:hidden hp:group-data-[checked=true]/command-item:opacity-100" />
</CommandPrimitive.Item>
