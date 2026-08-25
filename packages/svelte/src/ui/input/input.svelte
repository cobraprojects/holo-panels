<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"hp:h-8 hp:rounded-lg hp:border hp:border-input hp:bg-transparent hp:px-2.5 hp:py-1 hp:text-base hp:transition-colors hp:file:h-6 hp:file:text-sm hp:file:font-medium hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:disabled:bg-input/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:md:text-sm hp:dark:bg-input/30 hp:dark:disabled:bg-input/80 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:w-full hp:min-w-0 hp:outline-none hp:file:inline-flex hp:file:border-0 hp:file:bg-transparent hp:file:text-foreground hp:placeholder:text-muted-foreground hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
			className
		)}
		type="file"
		bind:files
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"hp:h-8 hp:rounded-lg hp:border hp:border-input hp:bg-transparent hp:px-2.5 hp:py-1 hp:text-base hp:transition-colors hp:file:h-6 hp:file:text-sm hp:file:font-medium hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:disabled:bg-input/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:md:text-sm hp:dark:bg-input/30 hp:dark:disabled:bg-input/80 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:w-full hp:min-w-0 hp:outline-none hp:file:inline-flex hp:file:border-0 hp:file:bg-transparent hp:file:text-foreground hp:placeholder:text-muted-foreground hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed hp:disabled:opacity-50",
			className
		)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
