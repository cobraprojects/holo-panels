<script lang="ts">
	import { Command as CommandPrimitive, useId } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		heading,
		value,
		...restProps
	}: CommandPrimitive.GroupProps & {
		heading?: string;
	} = $props();
</script>

<CommandPrimitive.Group
	bind:ref
	data-slot="command-group"
	class={cn("hp:overflow-hidden hp:p-1 hp:text-foreground hp:**:[[cmdk-group-heading]]:px-2 hp:**:[[cmdk-group-heading]]:py-1.5 hp:**:[[cmdk-group-heading]]:text-xs hp:**:[[cmdk-group-heading]]:font-medium hp:**:[[cmdk-group-heading]]:text-muted-foreground", className)}
	value={value ?? heading ?? `----${useId()}`}
	{...restProps}
>
	{#if heading}
		<CommandPrimitive.GroupHeading class="hp:px-2 hp:py-1.5 hp:text-xs hp:font-medium hp:text-muted-foreground">
			{heading}
		</CommandPrimitive.GroupHeading>
	{/if}
	<CommandPrimitive.GroupItems {children} />
</CommandPrimitive.Group>
