<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CommandPrimitive.LinkItemProps = $props();
</script>

<CommandPrimitive.LinkItem
	bind:ref
	data-slot="command-item"
	class={cn(
		"hp:relative hp:flex hp:cursor-default hp:items-center hp:gap-2 hp:rounded-sm hp:px-2 hp:py-1.5 hp:text-sm hp:outline-hidden hp:select-none hp:aria-selected:bg-accent hp:aria-selected:text-accent-foreground hp:data-[disabled=true]:pointer-events-none hp:data-[disabled=true]:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0 hp:[&_svg:not([class*='size-'])]:size-4 hp:[&_svg:not([class*='text-'])]:text-muted-foreground",
		className
	)}
	{...restProps}
/>
