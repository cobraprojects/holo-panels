<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLParagraphElement>> = $props();
</script>

<p
	bind:this={ref}
	data-slot="field-description"
	class={cn(
		"hp:text-start hp:text-sm hp:text-muted-foreground hp:[[data-variant=legend]+&]:-mt-1.5 hp:leading-normal hp:font-normal hp:group-has-[[data-orientation=horizontal]]/field:text-balance",
		"hp:last:mt-0 hp:nth-last-2:-mt-1",
		"hp:[&>a]:underline hp:[&>a]:underline-offset-4 hp:[&>a:hover]:text-primary",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</p>
