<script lang="ts">
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		loadingStatus = $bindable("loading"),
		size = "default",
		class: className,
		...restProps
	}: AvatarPrimitive.RootProps & {
		size?: "default" | "sm" | "lg";
	} = $props();
</script>

<AvatarPrimitive.Root
	bind:ref
	bind:loadingStatus
	data-slot="avatar"
	data-size={size}
	class={cn(
		"hp:size-8 hp:rounded-full hp:after:rounded-full hp:data-[size=lg]:size-10 hp:data-[size=sm]:size-6 hp:group/avatar hp:relative hp:flex hp:shrink-0 hp:select-none hp:after:absolute hp:after:inset-0 hp:after:border hp:after:border-border hp:after:mix-blend-darken hp:dark:after:mix-blend-lighten",
		className
	)}
	{...restProps}
/>
