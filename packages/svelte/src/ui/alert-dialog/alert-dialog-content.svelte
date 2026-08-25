<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import { cn, type WithoutChild, type WithoutChildrenOrChild } from "../../lib/utils.js";
	import AlertDialogOverlay from "./alert-dialog-overlay.svelte";
	import AlertDialogPortal from "./alert-dialog-portal.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		size = "default",
		portalProps,
		...restProps
	}: WithoutChild<AlertDialogPrimitive.ContentProps> & {
		size?: "default" | "sm";
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof AlertDialogPortal>>;
	} = $props();
</script>

<AlertDialogPortal {...portalProps}>
	<AlertDialogOverlay />
	<AlertDialogPrimitive.Content
		bind:ref
		data-slot="alert-dialog-content"
		data-panels-component="confirmation"
		data-size={size}
		class={cn(
			"hp:gap-4 hp:rounded-xl hp:bg-popover hp:p-4 hp:text-popover-foreground hp:ring-1 hp:ring-foreground/10 hp:duration-100 hp:data-[size=default]:max-w-xs hp:data-[size=sm]:max-w-xs hp:data-[size=default]:sm:max-w-sm hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-open:zoom-in-95 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:data-closed:zoom-out-95 hp:group/alert-dialog-content hp:fixed hp:top-1/2 hp:left-1/2 hp:z-50 hp:grid hp:w-full hp:-translate-x-1/2 hp:-translate-y-1/2 hp:outline-none",
			"hp-confirmation",
			className
		)}
		{...restProps}
	/>
</AlertDialogPortal>
