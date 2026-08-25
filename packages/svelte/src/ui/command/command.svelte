<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	export type CommandRootApi = CommandPrimitive.Root;

	let {
		api = $bindable(null),
		ref = $bindable(null),
		value = $bindable(""),
		class: className,
		...restProps
	}: CommandPrimitive.RootProps & {
		api?: CommandRootApi | null;
	} = $props();
</script>

<CommandPrimitive.Root
	bind:this={api}
	bind:value
	bind:ref
	data-slot="command"
	class={cn("hp:rounded-xl! hp:bg-popover hp:p-1 hp:text-popover-foreground hp:flex hp:size-full hp:flex-col hp:overflow-hidden", className)}
	{...restProps}
/>
