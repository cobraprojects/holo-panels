<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		variant = "default",
		...restProps
	}: DropdownMenuPrimitive.ItemProps & {
		inset?: boolean;
		variant?: "default" | "destructive";
	} = $props();
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	data-slot="dropdown-menu-item"
	data-inset={inset}
	data-variant={variant}
	class={cn(
		"hp:gap-1.5 hp:rounded-md hp:px-1.5 hp:py-1 hp:text-sm hp:focus:bg-accent hp:focus:text-accent-foreground hp:not-data-[variant=destructive]:focus:**:text-accent-foreground hp:data-inset:ps-7 hp:data-[variant=destructive]:text-destructive hp:data-[variant=destructive]:focus:bg-destructive/10 hp:data-[variant=destructive]:focus:text-destructive hp:dark:data-[variant=destructive]:focus:bg-destructive/20 hp:[&_svg:not([class*='size-'])]:size-4 hp:data-[variant=destructive]:*:[svg]:text-destructive hp:group/dropdown-menu-item hp:relative hp:flex hp:cursor-default hp:items-center hp:outline-hidden hp:select-none hp:data-[inset]:ps-8 hp:data-disabled:pointer-events-none hp:data-disabled:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		className
	)}
	{...restProps}
/>
