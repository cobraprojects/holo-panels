<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from "bits-ui";
	import CheckIcon from '@lucide/svelte/icons/check';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
	bind:ref
	data-slot="checkbox"
	class={cn(
		"hp:flex hp:size-4 hp:items-center hp:justify-center hp:rounded-[4px] hp:border hp:border-input hp:transition-colors hp:group-has-disabled/field:opacity-50 hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:aria-invalid:aria-checked:border-primary hp:dark:bg-input/30 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:data-checked:border-primary hp:data-checked:bg-primary hp:data-checked:text-primary-foreground hp:dark:data-checked:bg-primary hp:peer hp:relative hp:shrink-0 hp:outline-none hp:after:absolute hp:after:-inset-x-3 hp:after:-inset-y-2 hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
		className
	)}
	bind:checked
	bind:indeterminate
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<div
			data-slot="checkbox-indicator"
			class="hp:[&>svg]:size-3.5 hp:grid hp:place-content-center hp:text-current hp:transition-none"
		>
			{#if checked}
				<CheckIcon  />
			{:else if indeterminate}
				<MinusIcon  />
			{/if}
		</div>
	{/snippet}
</CheckboxPrimitive.Root>
