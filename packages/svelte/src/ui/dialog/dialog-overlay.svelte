<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
	bind:ref
	data-slot="dialog-overlay"
	class={cn("hp:bg-black/10 hp:duration-100 hp:supports-backdrop-filter:backdrop-blur-xs hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:fixed hp:inset-0 hp:isolate hp:z-50", className)}
	{...restProps}
/>
