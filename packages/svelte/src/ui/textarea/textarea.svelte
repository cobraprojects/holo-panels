<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "../../lib/utils.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		"hp:rounded-lg hp:border hp:border-input hp:bg-transparent hp:px-2.5 hp:py-2 hp:text-base hp:transition-colors hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:disabled:bg-input/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:md:text-sm hp:dark:bg-input/30 hp:dark:disabled:bg-input/80 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:flex hp:field-sizing-content hp:min-h-16 hp:w-full hp:outline-none hp:placeholder:text-muted-foreground hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
		className
	)}
	bind:value
	{...restProps}></textarea>
