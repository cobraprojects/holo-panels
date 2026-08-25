<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";
	import PopoverPortal from "./popover-portal.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		align = "center",
		portalProps,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
	} = $props();
</script>

<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		class={cn(
			"hp:flex hp:flex-col hp:gap-2.5 hp:rounded-lg hp:bg-popover hp:p-2.5 hp:text-sm hp:text-popover-foreground hp:shadow-md hp:ring-1 hp:ring-foreground/10 hp:duration-100 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-open:zoom-in-95 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:data-closed:zoom-out-95 hp:data-[side=inline-end]:slide-in-from-left-2 hp:data-[side=inline-start]:slide-in-from-right-2 hp:z-50 hp:w-72 hp:origin-(--transform-origin) hp:outline-hidden",
			className
		)}
		{...restProps}
	/>
</PopoverPortal>
