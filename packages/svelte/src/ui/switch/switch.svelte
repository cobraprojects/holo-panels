<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		size = "default",
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
		size?: "sm" | "default";
	} = $props();
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	data-size={size}
	class={cn(
		"hp:shrink-0 hp:rounded-full hp:border hp:border-transparent hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:data-[size=default]:h-[18.4px] hp:data-[size=default]:w-[32px] hp:data-[size=sm]:h-[14px] hp:data-[size=sm]:w-[24px] hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:data-checked:bg-primary hp:data-unchecked:bg-input hp:dark:data-unchecked:bg-input/80 hp:peer hp:group/switch hp:relative hp:inline-flex hp:items-center hp:transition-all hp:outline-none hp:after:absolute hp:after:-inset-x-3 hp:after:-inset-y-2 hp:data-disabled:cursor-not-allowed hp:data-disabled:opacity-50",
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class="hp:rounded-full hp:bg-background hp:group-data-[size=default]/switch:size-4 hp:group-data-[size=sm]/switch:size-3 hp:group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] hp:group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] hp:dark:data-checked:bg-primary-foreground hp:group-data-[size=default]/switch:data-unchecked:translate-x-0 hp:group-data-[size=sm]/switch:data-unchecked:translate-x-0 hp:dark:data-unchecked:bg-foreground hp:pointer-events-none hp:block hp:ring-0 hp:transition-transform hp:rtl:data-[state=checked]:translate-x-[calc(-100%)]"
	/>
</SwitchPrimitive.Root>
