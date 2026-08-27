<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLSelectAttributes } from "svelte/elements";

	type NativeSelectProps = Omit<WithElementRef<HTMLSelectAttributes>, "size"> & {
		size?: "sm" | "default";
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		size = "default",
		children,
		...restProps
	}: NativeSelectProps = $props();
</script>

<div
	class={cn(
		"hp:cn-native-select-wrapper hp:group/native-select hp:relative hp:w-full hp:has-[select:disabled]:opacity-50",
		className
	)}
	data-slot="native-select-wrapper"
	data-size={size}
>
	<select
		bind:value
		bind:this={ref}
		data-slot="native-select"
		data-size={size}
		class="hp:h-9 hp:w-full hp:min-w-0 hp:appearance-none hp:rounded-md hp:border hp:border-input hp:bg-transparent hp:py-1 hp:pe-9 hp:ps-3 hp:text-sm hp:transition-colors hp:select-none hp:selection:bg-primary hp:selection:text-primary-foreground hp:placeholder:text-muted-foreground hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:data-[size=sm]:h-8 hp:data-[size=sm]:rounded-[min(var(--radius-md),10px)] hp:data-[size=sm]:py-0.5 hp:dark:bg-input/30 hp:dark:hover:bg-input/50 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:outline-none hp:disabled:pointer-events-none hp:disabled:cursor-not-allowed"
		{...restProps}
	>
		{@render children?.()}
	</select>
	<ChevronDownIcon class="hp:top-1/2 hp:end-3.5 hp:size-4 hp:-translate-y-1/2 hp:text-muted-foreground hp:pointer-events-none hp:absolute hp:select-none" aria-hidden data-slot="native-select-icon" />
</div>
