<script lang="ts">
	import { Separator } from "../separator/index.js";
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		children?: Snippet;
	} = $props();

	const hasContent = $derived(!!children);
</script>

<div
	bind:this={ref}
	data-slot="field-separator"
	data-content={hasContent}
	class={cn("hp:-my-2 hp:h-5 hp:text-sm hp:group-data-[variant=outline]/field-group:-mb-2 hp:relative", className)}
	{...restProps}
>
	<Separator class="hp:absolute hp:inset-0 hp:top-1/2" />
	{#if children}
		<span
			class="hp:px-2 hp:text-muted-foreground hp:relative hp:mx-auto hp:block hp:w-fit hp:bg-background"
			data-slot="field-separator-content"
		>
			{@render children()}
		</span>
	{/if}
</div>
