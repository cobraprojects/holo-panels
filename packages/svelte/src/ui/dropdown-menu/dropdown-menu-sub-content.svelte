<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
	bind:ref
	data-slot="dropdown-menu-sub-content"
	class={cn("hp:min-w-[96px] hp:rounded-lg hp:bg-popover hp:p-1 hp:text-popover-foreground hp:shadow-lg hp:ring-1 hp:ring-foreground/10 hp:duration-100 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-open:zoom-in-95 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:data-closed:zoom-out-95 hp:w-auto", className)}
	{...restProps}
/>
