<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { Button } from "../button/index.js";
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		showCloseButton = false,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		showCloseButton?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn("hp:-mx-4 hp:-mb-4 hp:rounded-b-xl hp:border-t hp:bg-muted/50 hp:p-4 hp:flex hp:flex-col-reverse hp:gap-2 hp:sm:flex-row hp:sm:justify-end", className)}
	{...restProps}
>
	{@render children?.()}
	{#if showCloseButton}
		<DialogPrimitive.Close>
			{#snippet child({ props })}
				<Button variant="outline" {...props}><span class="hp:rtl:hidden">Close</span><span class="hp:hidden hp:rtl:inline">إغلاق</span></Button>
			{/snippet}
		</DialogPrimitive.Close>
	{/if}
</div>
