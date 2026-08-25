<script lang="ts">
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: AvatarPrimitive.FallbackProps = $props();
</script>

<AvatarPrimitive.Fallback
	bind:ref
	data-slot="avatar-fallback"
	class={cn(
		"hp:rounded-full hp:bg-muted hp:text-muted-foreground hp:flex hp:size-full hp:items-center hp:justify-center hp:text-sm hp:group-data-[size=sm]/avatar:text-xs",
		className
	)}
	{...restProps}
/>
