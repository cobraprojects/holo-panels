<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";
	import * as InputGroup from "../input-group/index.js";
	import SearchIcon from '@lucide/svelte/icons/search';
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(""),
		...restProps
	}: CommandPrimitive.InputProps = $props();
</script>

<div data-slot="command-input-wrapper" class="hp:p-1 hp:pb-0">
	<InputGroup.Root class="hp:h-8! hp:rounded-lg! hp:border-input/30 hp:bg-input/30 hp:shadow-none! hp:*:data-[slot=input-group-addon]:pl-2!">
		<CommandPrimitive.Input
			{value}
			data-slot="command-input"
			class={cn(
				"hp:w-full hp:text-sm hp:outline-hidden hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
				className
			)}
			{...restProps}
		>
			{#snippet child({ props })}
				<InputGroup.Input {...props} bind:value bind:ref />
			{/snippet}
		</CommandPrimitive.Input>
		<InputGroup.Addon>
			<SearchIcon class="hp:size-4 hp:shrink-0 hp:opacity-50" />
		</InputGroup.Addon>
	</InputGroup.Root>
</div>
