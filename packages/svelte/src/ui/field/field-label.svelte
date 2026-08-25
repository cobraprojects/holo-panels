<script lang="ts">
	import { Label } from "../label/index.js";
	import { cn } from "../../lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComponentProps<typeof Label> = $props();
</script>

<Label
	bind:ref
	data-slot="field-label"
	class={cn(
		"hp:gap-2 hp:leading-snug hp:group-data-[disabled=true]/field:opacity-50 hp:has-data-checked:border-primary/30 hp:has-data-checked:bg-primary/5 hp:has-[>[data-slot=field]]:rounded-lg hp:has-[>[data-slot=field]]:border hp:*:data-[slot=field]:p-2.5 hp:dark:has-data-checked:border-primary/20 hp:dark:has-data-checked:bg-primary/10 hp:group/field-label hp:peer/field-label hp:flex hp:w-fit hp:leading-snug",
		"hp:has-[>[data-slot=field]]:w-full hp:has-[>[data-slot=field]]:flex-col",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</Label>
