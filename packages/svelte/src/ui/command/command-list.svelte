<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CommandPrimitive.ListProps = $props();
</script>

<CommandPrimitive.List
	bind:ref
	data-slot="command-list"
	class={cn("hp:no-scrollbar hp:max-h-72 hp:scroll-py-1 hp:outline-none hp:overflow-x-hidden hp:overflow-y-auto", className)}
	{...restProps}
/>
