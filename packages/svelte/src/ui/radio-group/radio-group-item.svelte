<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
	import CircleIcon from '@lucide/svelte/icons/circle';
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> = $props();
</script>

<RadioGroupPrimitive.Item
	bind:ref
	data-slot="radio-group-item"
	class={cn(
		"hp:flex hp:size-4 hp:rounded-full hp:border-input hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:aria-invalid:aria-checked:border-primary hp:dark:bg-input/30 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:data-checked:border-primary hp:data-checked:bg-primary hp:data-checked:text-primary-foreground hp:dark:data-checked:bg-primary hp:group/radio-group-item hp:peer hp:relative hp:aspect-square hp:shrink-0 hp:border hp:outline-none hp:after:absolute hp:after:-inset-x-3 hp:after:-inset-y-2 hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
		className
	)}
	{...restProps}
>
	{#snippet children({ checked })}
		<div data-slot="radio-group-indicator" class="hp:flex hp:size-4 hp:items-center hp:justify-center">
			{#if checked}
				<CircleIcon class="hp:absolute hp:top-1/2 hp:left-1/2 hp:size-2 hp:-translate-x-1/2 hp:-translate-y-1/2 hp:rounded-full hp:bg-primary-foreground" />
			{/if}
		</div>
	{/snippet}
</RadioGroupPrimitive.Item>
