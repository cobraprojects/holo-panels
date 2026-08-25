<script lang="ts">
	import { Input } from "../input/index.js";
	import { cn } from "../../lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...props
	}: ComponentProps<typeof Input> = $props();
</script>

<Input
	bind:ref
	data-slot="input-group-control"
	class={cn("hp:rounded-none hp:border-0 hp:bg-transparent hp:shadow-none hp:ring-0 hp:focus-visible:ring-0 hp:disabled:bg-transparent hp:aria-invalid:ring-0 hp:dark:bg-transparent hp:dark:disabled:bg-transparent hp:flex-1", className)}
	bind:value
	{...props}
/>
